"""One-time lifetime export CLI.

Run this from a terminal for the first data pull so MFA (if enabled) can be
entered interactively:

    python export.py                # full lifetime pull
    python export.py --from 2018-01-01

The result is cached to ../data/activities.json for the API to serve.
"""

from __future__ import annotations

import argparse
import sys

from dotenv import load_dotenv

load_dotenv()

from garmin_service import EARLIEST_DATE, GarminServiceError, build_timeline, fetch_lifetime


def main() -> int:
    parser = argparse.ArgumentParser(description="Export lifetime Garmin activities.")
    parser.add_argument(
        "--from",
        dest="start",
        default=EARLIEST_DATE,
        help=f"Start date YYYY-MM-DD (default {EARLIEST_DATE}).",
    )
    parser.add_argument(
        "--to",
        dest="end",
        default=None,
        help="End date YYYY-MM-DD (default: today).",
    )
    args = parser.parse_args()

    print(f"Pulling activities from {args.start} to {args.end or 'today'} ...")
    try:
        activities = fetch_lifetime(args.start, args.end)
    except GarminServiceError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    timeline = build_timeline(activities)
    workout_days = sum(1 for d in timeline if not d["isRest"])
    rest_days = sum(1 for d in timeline if d["isRest"])
    print(
        f"Done. {len(activities)} activities cached across "
        f"{len(timeline)} days ({workout_days} active / {rest_days} rest)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
