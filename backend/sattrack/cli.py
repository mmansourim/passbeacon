import argparse
import time
from .catalog import DEFAULT_SATELLITE_ID, DEFAULT_STATION_KEY, get_station, list_stations
from .orbits import get_station_report, compare_stations
def main():
    import sys
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    from .display import render_report

    parser = argparse.ArgumentParser(description="Ground Station Tracker")
    parser.add_argument("--sat",   type=int, default=DEFAULT_SATELLITE_ID,
                        help="NORAD ID (default: 25544 ISS)")
    parser.add_argument("--compare", nargs="+", type=str,
                    help="Compare passes for multiple stations e.g. --compare oran london paris")
    parser.add_argument("--hours", type=int, default=24,
                        help="Hours ahead to predict passes")
    parser.add_argument("--watch", action="store_true",
                        help="Refresh every 10 seconds")
    parser.add_argument("--gs",    type=str, default=DEFAULT_STATION_KEY,
                        help=f"Ground station: {', '.join(list_stations())}")
    args = parser.parse_args()

    if args.hours <= 0:
        parser.error("--hours must be positive")

    # Look up the ground station
    station = get_station(args.gs)

    if station is None:
        print(f"Unknown station '{args.gs}'")
        print(f"Available: {', '.join(list_stations())}")
        raise SystemExit(1)

    # ── Compare mode ──────────────────────────────────────
    if args.compare:
        from .display import render_comparison
        print(f"\nComparing {len(args.compare)} stations...")
        results, satellite_name = compare_stations(
            args.compare, norad_id=args.sat, hours=args.hours
        )
        render_comparison(results, satellite_name, args.hours)

    # ── Watch mode ────────────────────────────────────────
    elif args.watch:
        while True:
            report = get_station_report(
                norad_id = args.sat,
                station_latitude   = station["lat"],
                station_longitude   = station["lon"],
                station_altitude_m   = station["alt"],
                station_name  = station["name"],
                hours    = args.hours,
            )
            render_report(report)
            time.sleep(10)

    # ── Single station mode ───────────────────────────────
    else:
        station = get_station(args.gs)
        if station is None:
            print(f"Unknown station '{args.gs}'")
            print(f"Available: {', '.join(list_stations())}")
            raise SystemExit(1)
        report = get_station_report(
            norad_id = args.sat,
            station_latitude   = station["lat"],
            station_longitude   = station["lon"],
            station_altitude_m   = station["alt"],
            station_name  = station["name"],
            hours    = args.hours,
        )
        render_report(report)


if __name__ == "__main__":
    main()
