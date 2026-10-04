import math
from datetime import datetime, timezone, timedelta
from skyfield.api import load, wgs84, EarthSatellite
from .catalog import DEFAULT_SATELLITE_ID, DEFAULT_STATION_KEY, STATIONS, get_station
from .tle import fetch_tle
from .settings import Settings
DEFAULT_STATION_LATITUDE = STATIONS[DEFAULT_STATION_KEY]["lat"]
DEFAULT_STATION_LONGITUDE = STATIONS[DEFAULT_STATION_KEY]["lon"]
DEFAULT_STATION_ALTITUDE_M = STATIONS[DEFAULT_STATION_KEY]["alt"]


def haversine(lat1, lon1, lat2, lon2, R=6371):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    # the Haversine formula
    a = (math.sin(dlat / 2) ** 2
     + math.cos(math.radians(lat2))
     * math.cos(math.radians(lat1))
     * math.sin(dlon / 2) ** 2)

    distance = 2 * R * math.asin(math.sqrt(a))

    return distance

def get_bearing(lat1, lon1, lat2, lon2):

    dlon = math.radians(lon2 - lon1)
    
    bearing = math.atan2(math.sin(dlon) * math.cos(math.radians(lat2)), math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(dlon))

    bearing = math.degrees(bearing) 
    bearing = (bearing + 360) % 360

    return bearing

def get_elevation_and_range(distance_km, altitude_km, R=6371):
    
    gamma = distance_km / R
    rho   = math.sqrt(
        R**2 + (R + altitude_km)**2
        - 2 * R * (R + altitude_km) * math.cos(gamma)
    )
    elevation = math.degrees(math.atan2((R + altitude_km) * math.cos(gamma) - R,
                                       (R + altitude_km) * math.sin(gamma)))
    return elevation, rho

def elevation_status(elevation, min_elevation):
    if elevation >= min_elevation:
        return "Above prediction threshold"
    elif elevation >= 0:
        return "Above horizon — below prediction threshold"
    else:
        return "Below horizon"

def get_direction(bearing):
    if 0 <= bearing <= 45 or 315 < bearing <= 360:
        return "NORTH"
    elif 45 < bearing <= 135:
        return "EAST"
    elif 135 < bearing <= 225:
        return "SOUTH"
    else:
        return "WEST"

def predict_passes(satellite, observer, timescale, hours=24, *, now=None, min_elevation=None):
    now = now or datetime.now(timezone.utc)
    threshold = Settings.from_env().min_elevation if min_elevation is None else min_elevation
    search_start  = timescale.from_datetime(now)
    search_end = timescale.from_datetime(now + timedelta(hours=hours))
    # Recover the true rise and peak when startup/refresh happens during a pass.
    if (satellite - observer).at(search_start).altaz()[0].degrees >= threshold:
        period_minutes = 2 * math.pi / satellite.model.no_kozai
        lookback = min(2880, max(180, 2 * period_minutes))
        search_start = timescale.from_datetime(now - timedelta(minutes=lookback))
    

    passes = [] 

    times, events = satellite.find_events(observer, search_start, search_end, altitude_degrees=threshold)

    aos_dt  = None
    aos_str = None
    tca_str = None
    max_elevation = None

    for i in range(len(times)):
        if events[i] == 0:
            # New pass starting — reset everything
            aos_str = times[i].utc_datetime().strftime("%Y-%m-%d %H:%M:%S")
            aos_dt  = times[i].utc_datetime()
            tca_str = None
            max_elevation = None

            # Get satellite position at AOS
            geocentric_position     = satellite.at(times[i])
            subpoint     = wgs84.subpoint(geocentric_position)
            aos_lat = subpoint.latitude.degrees
            aos_lon = subpoint.longitude.degrees

            # Azimuth at AOS
            topo_aos        = (satellite - observer).at(times[i])
            _, az_aos, _    = topo_aos.altaz()
            aos_az          = az_aos.degrees

        elif events[i] == 1:
            # Only record TCA if we have a valid AOS first
            if aos_dt is None:
                continue
            alt, _, _ = (satellite - observer).at(times[i]).altaz()
            if max_elevation is not None and alt.degrees <= max_elevation:
                continue
            tca_str = times[i].utc_datetime().strftime("%Y-%m-%d %H:%M:%S")
            tca_dt  = times[i].utc_datetime()

            # Position at TCA
            geocentric_position     = satellite.at(times[i])
            subpoint     = wgs84.subpoint(geocentric_position)
            tca_lat = subpoint.latitude.degrees
            tca_lon = subpoint.longitude.degrees

            difference  = satellite - observer
            topocentric = difference.at(times[i])
            alt, az, _  = topocentric.altaz()
            max_elevation = alt.degrees

        elif events[i] == 2:
            # Only record a complete pass if we have AOS + TCA
            if aos_dt is None or max_elevation is None:
                continue

            # Position at LOS
            geocentric_position     = satellite.at(times[i])
            subpoint     = wgs84.subpoint(geocentric_position)
            los_lat = subpoint.latitude.degrees
            los_lon = subpoint.longitude.degrees

            # Azimuth at LOS
            topo_los        = (satellite - observer).at(times[i])
            _, az_los, _    = topo_los.altaz()
            los_az          = az_los.degrees

            los_str  = times[i].utc_datetime().strftime("%Y-%m-%d %H:%M:%S")
            los_dt   = times[i].utc_datetime()
            duration = int((los_dt - aos_dt).total_seconds())

            if max_elevation > 45:
                quality = "★★★ EXCELLENT"
            elif max_elevation > 20:
                quality = "★★  GOOD"
            else:
                quality = "★   LOW"

            passes.append({
                "aos":           aos_str,
                "tca":           tca_str,
                "los":           los_str,
                "aos_dt":        aos_dt,
                "los_dt":        los_dt,
                "aos_lat":       aos_lat,    
                "aos_lon":       aos_lon,  
                "aos_az":        round(aos_az, 1),
                "los_az":        round(los_az, 1),  
                "tca_lat":       tca_lat,    
                "tca_lon":       tca_lon,
                "los_lat":       los_lat,
                "los_lon":       los_lon,    
                "duration":      duration,
                "max_elevation": max_elevation,
                "quality":       quality,
            })

            # Reset for next pass
            aos_dt = None
    
    return [p for p in passes if p['los_dt'] > now]

def load_satellite(norad_id=DEFAULT_SATELLITE_ID):
    
    timescale = load.timescale()
    name, line1, line2 = fetch_tle(norad_id)
    satellite = EarthSatellite(line1, line2, name, timescale)
    print(f"  Loaded: {name}")
    return satellite, timescale, name

def az_to_compass(degrees: float) -> str:

    dirs = ["N","NE","E","SE","S","SW","W","NW"]
    idx  = round(degrees / 45) % 8
    return dirs[idx]

def get_station_report(norad_id=DEFAULT_SATELLITE_ID, station_latitude=DEFAULT_STATION_LATITUDE,
                        station_longitude=DEFAULT_STATION_LONGITUDE, station_altitude_m=DEFAULT_STATION_ALTITUDE_M,
                        station_name="Oran", hours=24,
                        satellite=None, timescale=None, satellite_name=None, now=None):

    now = now or datetime.now(timezone.utc)
    if satellite is None or timescale is None:
        satellite, timescale, satellite_name = load_satellite(norad_id)
    settings = Settings.from_env()
    current_time = timescale.from_datetime(now)
    subpoint = wgs84.subpoint(satellite.at(current_time))
    lat, lon = subpoint.latitude.degrees, subpoint.longitude.degrees
    distance = haversine(station_latitude, station_longitude, lat, lon)
    observer = wgs84.latlon(station_latitude, station_longitude, elevation_m=station_altitude_m)
    alt, az, slant_range = (satellite - observer).at(current_time).altaz()
    elevation, bearing = alt.degrees, az.degrees
    direction = az_to_compass(bearing)
    status = elevation_status(elevation, settings.min_elevation)
    lat_dir = "North" if lat >= 0 else "South"
    lon_dir = "East" if lon >= 0 else "West"

    passes = predict_passes(satellite, observer, timescale, hours=hours, now=now,
                            min_elevation=settings.min_elevation)
    epoch_age = (now - satellite.epoch.utc_datetime()).total_seconds() / 3600
    warnings = []
    if abs(epoch_age) > settings.epoch_warning_hours:
        relation = "old" if epoch_age >= 0 else "in the future"
        warnings.append(f"TLE epoch is {abs(epoch_age):.1f} hours {relation}; predictions may be inaccurate.")

    now_utc   = now
    next_pass = None
    for p in passes:
        if p["aos_dt"] > now_utc:
            next_pass = p
            break

    next_pass_in = None
    if next_pass:
        delta        = next_pass["aos_dt"] - now_utc
        total_secs   = int(delta.total_seconds())
        hours_left   = total_secs // 3600
        mins_left    = (total_secs % 3600) // 60
        next_pass_in = {"hours": hours_left, "mins": mins_left}

    return {
        "generated_at":   now.strftime("%Y-%m-%d %H:%M:%S"),
        "hours":          hours,
        "min_elevation":  settings.min_elevation,
        "warnings":       warnings,
        "satellite":      satellite_name,
        "ground_station": {"name": station_name, "lat": station_latitude, "lon": station_longitude},
        "position": {
            "lat":       lat,
            "lon":       lon,
            "lat_dir":   lat_dir,
            "lon_dir":   lon_dir,
            "distance":  distance,  # Surface distance to the satellite subpoint, km.
            "slant_range_km": slant_range.km,
            "bearing":   bearing,
            "direction": direction,
            "elevation": elevation,
            "status":    status,
        },
        "passes":       passes,
        "next_pass":    next_pass,
        "next_pass_in": next_pass_in,
    }

def compare_stations(station_names, norad_id=DEFAULT_SATELLITE_ID, hours=24):
    
    satellite, timescale, satellite_name = load_satellite(norad_id)

    results = []
    now = datetime.now(timezone.utc)
    shown_warnings = set()

    for name in station_names:
        station = get_station(name)

        if station is None:
            print(f"  [!] Unknown station '{name}' — skipping")
            continue

        print(f"  Computing passes for {station['name']}...")

        # Reuse the satellite and timescale without fetching elements again.
        report = get_station_report(
            norad_id  = norad_id,
            station_latitude    = station["lat"],
            station_longitude    = station["lon"],
            station_altitude_m    = station["alt"],
            station_name   = station["name"],
            hours     = hours,
            satellite       = satellite,
            timescale        = timescale,
            satellite_name  = satellite_name,
            now       = now,
        )

        for warning in report["warnings"]:
            if warning not in shown_warnings:
                print(f"  Warning: {warning}")
                shown_warnings.add(warning)
        passes = report["passes"]
        total_pass_seconds = sum(p["duration"] for p in passes)
        best = max(passes, key=lambda p: p["max_elevation"]) if passes else None

        next_pass_in = report["next_pass_in"]
        next_pass_str = f"{next_pass_in['hours']}h {next_pass_in['mins']}m" if next_pass_in else "none"

        results.append({
            "station":        station["name"],
            "passes":         len(passes),
            "best_elevation": best["max_elevation"] if best else 0,
            "best_quality":   best["quality"] if best else "—",
            "total_pass_seconds":  total_pass_seconds,
            "next_pass":      next_pass_str,
        })

    return results, satellite_name
