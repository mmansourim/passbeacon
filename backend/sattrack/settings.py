from dataclasses import dataclass, field
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]

@dataclass(frozen=True)
class Settings:
    cache_dir: Path = field(default_factory=lambda: Path.home() / '.cache' / 'sattrack')
    offline: bool = False
    hours: int = 24
    min_elevation: float = 10.0
    refresh_seconds: int = 300
    tle_max_age_hours: float = 24.0
    epoch_warning_hours: float = 72.0
    host: str = '127.0.0.1'
    port: int = 8000
    frontend_dir: Path = field(default_factory=lambda: ROOT / 'frontend' / 'dist')

    @classmethod
    def from_env(cls):
        value = cls(
            cache_dir=Path(os.getenv('SATTRACK_CACHE_DIR', str(Path.home() / '.cache' / 'sattrack'))).expanduser().resolve(),
            offline=os.getenv('SATTRACK_OFFLINE','0').lower() in ('1','true','yes'),
            hours=int(os.getenv('SATTRACK_HOURS','24')),
            min_elevation=float(os.getenv('SATTRACK_MIN_ELEVATION','10')),
            refresh_seconds=int(os.getenv('SATTRACK_REFRESH_SECONDS','300')),
            tle_max_age_hours=float(os.getenv('SATTRACK_TLE_MAX_AGE_HOURS','24')),
            epoch_warning_hours=float(os.getenv('SATTRACK_EPOCH_WARNING_HOURS','72')),
            host=os.getenv('SATTRACK_HOST','127.0.0.1'),
            port=int(os.getenv('SATTRACK_PORT','8000')),
            frontend_dir=Path(os.getenv('SATTRACK_FRONTEND_DIR',str(ROOT / 'frontend' / 'dist'))).resolve(),
        )
        if not 1 <= value.hours <= 168: raise ValueError('SATTRACK_HOURS must be between 1 and 168')
        if not 0 <= value.min_elevation < 90: raise ValueError('Elevation must be >= 0 and < 90')
        if value.refresh_seconds < 30: raise ValueError('Refresh interval must be at least 30 seconds')
        if value.tle_max_age_hours <= 0 or value.epoch_warning_hours <= 0: raise ValueError('Age thresholds must be positive')
        if not 1 <= value.port <= 65535: raise ValueError('Port must be between 1 and 65535')
        return value
