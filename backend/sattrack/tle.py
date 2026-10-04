import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4
import requests
from .settings import Settings

log = logging.getLogger(__name__)
_cache_lock = Lock()

class TLEClient:
    def __init__(self, settings=None):
        self.settings = settings or Settings.from_env()

    def load(self, norad_id, *, now=None):
        now = now or datetime.now(timezone.utc)
        norad_id = str(int(norad_id))
        path = self.settings.cache_dir / f'{norad_id}.json'
        cached = None
        try:
            cached = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(cached, dict) or not all(isinstance(cached.get(key), str)
                    for key in ('name', 'line1', 'line2', 'fetched_at')):
                raise ValueError('Cache fields are missing or malformed')
            fetched = datetime.fromisoformat(cached['fetched_at'])
            if fetched.tzinfo is None: raise ValueError('Cache timestamp has no timezone')
            if not cached['line1'].startswith('1 ') or not cached['line2'].startswith('2 '): raise ValueError('Invalid cached TLE')
            if int(cached['line1'][2:7]) != int(norad_id) or int(cached['line2'][2:7]) != int(norad_id): raise ValueError('Cached catalog ID mismatch')
            age = (now - fetched).total_seconds() / 3600
        except (OSError, ValueError, KeyError, TypeError):
            cached = None
        if cached and (self.settings.offline or 0 <= age < self.settings.tle_max_age_hours):
            return {**cached, 'source': 'offline cache' if self.settings.offline else 'cache',
                    'warning': 'Offline mode: using cached orbital elements.' if self.settings.offline else None}
        if self.settings.offline: raise ValueError(f'No usable offline cache for {norad_id}')
        try:
            response = requests.get('https://celestrak.org/NORAD/elements/gp.php',
                params={'CATNR':norad_id, 'FORMAT':'TLE'}, timeout=10)
            response.raise_for_status()
            lines = response.text.strip().splitlines()
            if len(lines) < 3 or not lines[1].startswith('1 ') or not lines[2].startswith('2 '):
                raise ValueError('Invalid TLE response')
            if int(lines[1][2:7]) != int(norad_id) or int(lines[2][2:7]) != int(norad_id):
                raise ValueError('Downloaded catalog ID mismatch')
            entry = dict(name=lines[0].strip(), line1=lines[1], line2=lines[2], fetched_at=now.isoformat())
        except (requests.RequestException, ValueError) as exc:
            if cached:
                log.warning('TLE fetch failed for %s; using old cache: %s', norad_id, exc)
                return {**cached, 'source':'fallback cache', 'warning':f'Download failed; using older cache: {exc}'}
            raise ValueError(f'No orbital data for {norad_id}: {exc}') from exc
        warning = None
        try:
            with _cache_lock:
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_suffix(f'.{uuid4().hex}.tmp')
                temporary.write_text(json.dumps(entry, indent=2), encoding='utf-8')
                temporary.replace(path)
        except OSError as exc:
            warning = f'Fresh data loaded but cache could not be saved: {exc}'
            log.warning(warning)
        return {**entry, 'source':'download', 'warning':warning}

def fetch_tle(norad_id):
    """Load orbital elements for the command-line tracker."""
    entry = TLEClient().load(norad_id)
    if entry['warning']: log.warning(entry['warning'])
    return entry['name'], entry['line1'], entry['line2']
