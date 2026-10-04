"""
catalog.py — Shared ground station and satellite 
Add any location here and use it with --gs flag
"""

DEFAULT_SATELLITE_ID = 25544
DEFAULT_STATION_KEY = "oran"

STATIONS = {
    "oran": {
        "name":    "Oran, Algeria",
        "lat":     35.6987,
        "lon":     -0.6349,
        "alt":     90,
    },
    "algiers": {
        "name":    "Algiers, Algeria",
        "lat":     36.7372,
        "lon":     3.0865,
        "alt":     25,
    },
    "paris": {
        "name":    "Paris, France",
        "lat":     48.8566,
        "lon":     2.3522,
        "alt":     35,
    },
    "new york": {
        "name":    "New York, USA",
        "lat":     40.7128,
        "lon":     -74.0060,
        "alt":     15,
    },
    "london": {
        "name":    "London, UK",
        "lat":     51.5074,
        "lon":     -0.1278,
        "alt":     11,
    },
    "moscow": {
        "name":    "Moscow, Russia",
        "lat":     55.7558,
        "lon":     37.6173,
        "alt":     156,
    },
    "nairobi": {
        "name":    "Nairobi, Kenya",
        "lat":     -1.2921,
        "lon":     36.8219,
        "alt":     1661,
    },
    "tokyo": {
        "name":    "Tokyo, Japan",
        "lat":     35.6895,
        "lon":     139.6917,
        "alt":     40,  # Assumed city elevation in metres; adjust for the actual site.
    },
    "perth": {
        "name":    "Perth, Australia",
        "lat":     -31.9522,
        "lon":     115.8614,
        "alt":     15,  # Assumed city elevation in metres; adjust for the actual site.
    },
}


def get_station(name: str) -> dict:
    
    return STATIONS.get(name.lower())


def list_stations() -> list:

    return list(STATIONS.keys())

SATELLITES = {
    "25544": {"name": "ISS (ZARYA)",          "color": "#a78bfa"},
    "20580": {"name": "Hubble Space Telescope","color": "#38bdf8"},
    "43013": {"name": "NOAA-20",              "color": "#4ade80"},
}
