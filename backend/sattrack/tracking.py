import asyncio
import logging
import math
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from skyfield.api import load, EarthSatellite, wgs84
from .catalog import SATELLITES, STATIONS
from .orbits import predict_passes
from .tle import TLEClient

log = logging.getLogger(__name__)

class Tracker:
    def __init__(self, settings, client=None):
        self.settings = settings
        self.client = client or TLEClient(settings)
        self.timescale = load.timescale(builtin=True)
        self.snapshot = {'generation':'', 'generated_at':None, 'satellites':{}, 'errors':{}}
        self.refresh_error = None
        self._refresh_lock = asyncio.Lock()

    def build_snapshot(self, now=None):
        now = now or datetime.now(timezone.utc)
        result = {'generation':uuid4().hex, 'generated_at':now.isoformat(), 'satellites':{}, 'errors':{}}
        for sat_id, meta in SATELLITES.items():
            try:
                tle = self.client.load(sat_id, now=now)
                satellite = EarthSatellite(tle['line1'], tle['line2'], tle['name'], self.timescale)
                epoch_age = (now - satellite.epoch.utc_datetime()).total_seconds() / 3600
                times = self.timescale.from_datetimes([now + timedelta(seconds=s) for s in range(0,self.settings.hours*3600,60)])
                points = wgs84.subpoint(satellite.at(times))
                lats, lons = points.latitude.degrees.tolist(), points.longitude.degrees.tolist()
                if not all(math.isfinite(x) for x in lats+lons): raise ValueError('Orbit propagation produced invalid coordinates')
                warnings = [tle['warning']] if tle['warning'] else []
                if abs(epoch_age) > self.settings.epoch_warning_hours:
                    warnings.append(f'TLE epoch is {epoch_age:.1f} hours old; predictions may be inaccurate.')
                data = {'id':sat_id, 'name':tle['name'], 'color':meta['color'], 'sat':satellite,
                    'track':{'lats':lats,'lons':lons}, 'period_minutes':2*math.pi/satellite.model.no_kozai,
                    'tle_line1':tle['line1'], 'tle_line2':tle['line2'],
                    'tle_fetched_at':tle['fetched_at'], 'tle_epoch':satellite.epoch.utc_datetime().isoformat(),
                    'tle_source':tle['source'], 'warnings':warnings, 'passes':{}, 'pass_errors':{},
                    'generated_at':now.isoformat()}
                for key, station in STATIONS.items():
                    try:
                        observer = wgs84.latlon(station['lat'],station['lon'],elevation_m=station['alt'])
                        events = predict_passes(satellite,observer,self.timescale,hours=self.settings.hours,
                            now=now,min_elevation=self.settings.min_elevation)
                        data['passes'][key] = [{**{k:v for k,v in p.items() if k not in ('aos_dt','los_dt')},
                            'rise_az':p['aos_az'],'set_az':p['los_az']} for p in events]
                    except Exception as exc:
                        data['pass_errors'][key] = str(exc)
                        log.exception('Pass calculation failed for %s/%s',sat_id,key)
                result['satellites'][sat_id] = data
            except Exception as exc:
                result['errors'][sat_id] = str(exc)
                # Retain last usable data, visibly marked as stale.
                if sat_id in self.snapshot['satellites']:
                    old = self.snapshot['satellites'][sat_id]
                    result['satellites'][sat_id] = {**old, 'warnings':list(dict.fromkeys(list(dict.fromkeys([*old['warnings'], 'Refresh failed; retaining previous predictions.']))))}
                log.exception('Satellite refresh failed for %s',sat_id)
        return result

    async def refresh(self):
        async with self._refresh_lock:
            try:
                self.snapshot = await asyncio.to_thread(self.build_snapshot)
                self.refresh_error = None
            except Exception as exc:
                self.refresh_error = str(exc)
                log.exception('Refresh failed; retaining previous snapshot')

    async def refresh_loop(self):
        while True:
            await asyncio.sleep(self.settings.refresh_seconds)
            await self.refresh()

    def position(self, data, now=None):
        geocentric_position = data['sat'].at(self.timescale.from_datetime(now or datetime.now(timezone.utc)))
        point = wgs84.subpoint(geocentric_position)
        lat,lon,alt = point.latitude.degrees,point.longitude.degrees,point.elevation.km
        velocity = float(geocentric_position.velocity.km_per_s.dot(geocentric_position.velocity.km_per_s)**0.5)
        if not all(math.isfinite(x) for x in (lat,lon,alt,velocity)): raise ValueError('Invalid current orbit position')
        return dict(id=data['id'],name=data['name'],color=data['color'],lat=round(lat,4),
            lon=round(lon,4),alt=round(alt,2),velocity=round(velocity,3))

    def positions(self):
        result=[]
        for data in self.snapshot['satellites'].values():
            try: result.append(self.position(data))
            except Exception: log.exception('Current position failed for %s',data['id'])
        return result

    def status(self):
        snapshot=self.snapshot
        warnings={key:value['warnings'] for key,value in snapshot['satellites'].items() if value['warnings']}
        pass_errors={key:value['pass_errors'] for key,value in snapshot['satellites'].items() if value['pass_errors']}
        return {'generation':snapshot['generation'],'generated_at':snapshot['generated_at'],
            'loaded':len(snapshot['satellites']),'errors':snapshot['errors'], 'pass_errors':pass_errors,
            'warnings':warnings,'refresh_error':self.refresh_error, 'hours':self.settings.hours,
            'refresh_seconds':self.settings.refresh_seconds, 'min_elevation':self.settings.min_elevation}
