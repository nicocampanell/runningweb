"""Single source of truth for the visual mapping used by the timeline.

Color tokens and height-scale constants live here so the backend derives the
exact values the frontend renders. The three named colors (swim / lift / random)
come straight from the Figma file; the rest are configurable extensions.
"""

from __future__ import annotations

# --- Colors from the Figma file -------------------------------------------------
COLOR_SWIM = "#E96D6D"  # swim / coral
COLOR_LIFT = "#9FD2D5"  # strength / teal
COLOR_RANDOM = "#CCAEE0"  # other / purple (the "random" bucket)

# --- Proposed, configurable extensions -----------------------------------------
COLOR_RUN = "#E9C46A"  # running / amber
COLOR_CYCLE = "#6D9EE9"  # cycling / blue
COLOR_WALK = "#8AC48A"  # walking + hiking / green
COLOR_REST = "#C9CED3"  # rest day / grey

# Map Garmin `activityType.typeKey` values onto a color bucket. Anything not
# listed here falls back to the "random" color.
TYPE_COLOR_MAP: dict[str, str] = {
    # swim family
    "swimming": COLOR_SWIM,
    "lap_swimming": COLOR_SWIM,
    "open_water_swimming": COLOR_SWIM,
    # strength / lift family
    "strength_training": COLOR_LIFT,
    "indoor_cardio": COLOR_LIFT,
    "fitness_equipment": COLOR_LIFT,
    "yoga": COLOR_LIFT,
    "pilates": COLOR_LIFT,
    # run family
    "running": COLOR_RUN,
    "trail_running": COLOR_RUN,
    "treadmill_running": COLOR_RUN,
    "track_running": COLOR_RUN,
    "indoor_running": COLOR_RUN,
    # cycle family
    "cycling": COLOR_CYCLE,
    "road_biking": COLOR_CYCLE,
    "mountain_biking": COLOR_CYCLE,
    "indoor_cycling": COLOR_CYCLE,
    "virtual_ride": COLOR_CYCLE,
    "gravel_cycling": COLOR_CYCLE,
    # walk / hike family
    "walking": COLOR_WALK,
    "hiking": COLOR_WALK,
    "casual_walking": COLOR_WALK,
    "speed_walking": COLOR_WALK,
}

# Friendly bucket label per color, for tooltips / legends.
COLOR_LABEL: dict[str, str] = {
    COLOR_SWIM: "swim",
    COLOR_LIFT: "lift",
    COLOR_RUN: "run",
    COLOR_CYCLE: "cycle",
    COLOR_WALK: "walk",
    COLOR_RANDOM: "random",
    COLOR_REST: "rest",
}

# Coarse "bucket" name per type key, used to pick the sport icon on the frontend.
TYPE_BUCKET_MAP: dict[str, str] = {
    "swimming": "swim",
    "lap_swimming": "swim",
    "open_water_swimming": "swim",
    "strength_training": "lift",
    "indoor_cardio": "lift",
    "fitness_equipment": "lift",
    "yoga": "lift",
    "pilates": "lift",
    "running": "run",
    "trail_running": "run",
    "treadmill_running": "run",
    "track_running": "run",
    "indoor_running": "run",
    "cycling": "cycle",
    "road_biking": "cycle",
    "mountain_biking": "cycle",
    "indoor_cycling": "cycle",
    "virtual_ride": "cycle",
    "gravel_cycling": "cycle",
    "walking": "walk",
    "hiking": "walk",
    "casual_walking": "walk",
    "speed_walking": "walk",
}

# --- Height scale (pixels) ------------------------------------------------------
SCALE = 3.0
REST_HEIGHT = 24  # fixed grey line length for a day with no workout
BASE_HEIGHT = 32  # base length every activity gets before its duration is added
# Above the base, heights are proportional to activity minutes. A single global
# factor is derived at timeline-build time so the tallest day column exactly
# reaches MAX_COLUMN_HEIGHT and everything else scales linearly from there.
MAX_COLUMN_HEIGHT = int(round(300 * SCALE))
SEGMENT_GAP = 2  # vertical gap between stacked activity segments (px)


def color_for_type(type_key: str | None) -> str:
    """Return the color hex for a Garmin activity type key."""
    if not type_key:
        return COLOR_RANDOM
    return TYPE_COLOR_MAP.get(type_key.lower(), COLOR_RANDOM)


def bucket_for_type(type_key: str | None) -> str:
    """Return the coarse sport bucket (for icon selection)."""
    if not type_key:
        return "random"
    return TYPE_BUCKET_MAP.get(type_key.lower(), "random")


def config_payload() -> dict:
    """Expose the visual config to the frontend via the API."""
    return {
        "colors": {
            "swim": COLOR_SWIM,
            "lift": COLOR_LIFT,
            "run": COLOR_RUN,
            "cycle": COLOR_CYCLE,
            "walk": COLOR_WALK,
            "random": COLOR_RANDOM,
            "rest": COLOR_REST,
        },
        "labels": COLOR_LABEL,
        "heights": {
            "rest": REST_HEIGHT,
            "base": BASE_HEIGHT,
            "maxColumn": MAX_COLUMN_HEIGHT,
            "segmentGap": SEGMENT_GAP,
        },
    }
