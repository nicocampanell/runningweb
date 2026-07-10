# Workout Equalizer — "chasing something"

A personal data-art webapp that renders your **lifetime Garmin activity history**
as a horizontal equalizer of vertical lines:

- **Color** encodes the workout type (swim, lift, run, cycle, walk, other).
- **Height** scales with the activity's duration (time).
- **Multiple activities in a day** stack vertically as separate segments with 2px spacing.
- **Rest days** appear as short grey `45px` lines, so gaps are visible.
- **Hovering** a day shows a card (date + per-activity sport icon, distance, and pace;
  or "rest"), matching the Figma hover designs.

Data is pulled from Garmin Connect via
[python-garminconnect](../garminconnect) and cached locally; the frontend
reproduces the Figma design (title + arrow, centered faint runner, progress bar).

```
webapp/
  backend/        FastAPI + garminconnect data service
    config.py         color map + height-scale (single source of truth)
    garmin_service.py login, lifetime fetch, per-day timeline derivation
    app.py            REST API (/api/timeline, /api/refresh, /api/config, /api/health)
    export.py         one-time lifetime export CLI
  frontend/       Vite + React + TypeScript + Tailwind
  data/           cached activities.json (gitignored)
```

## 1. Backend setup

```bash
cd webapp/backend
python -m venv .venv && source .venv/bin/activate      # or reuse the repo .venv
pip install -r requirements.txt
```

Add your Garmin credentials (only needed for the first login — afterwards an
OAuth token is cached in `~/.garminconnect`):

```bash
cp ../.env.example ../.env
# edit ../.env and set EMAIL / PASSWORD
```

## 2. Pull your lifetime data

Run the export from a terminal so any MFA one-time code can be entered:

```bash
python export.py                 # full lifetime pull
python export.py --from 2018-01-01   # optional narrower start
```

This writes `webapp/data/activities.json`.

## 3. Run

Backend:

```bash
cd webapp/backend
uvicorn app:app --reload --port 8000
```

Frontend (in another terminal):

```bash
cd webapp/frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend
on port 8000.

The **sync** button (top-right) calls `POST /api/refresh` to incrementally pull
newly-completed activities. `POST /api/refresh?full=true` re-pulls everything.

## Customizing the look

All visual mapping lives in [`backend/config.py`](backend/config.py):

- `TYPE_COLOR_MAP` / `TYPE_BUCKET_MAP` — which Garmin `activityType.typeKey` maps
  to which color and which sport-icon bucket.
- `COLOR_*` — the hex tokens (the three from the Figma file are `swim #E96D6D`,
  `lift #9FD2D5`, `random #CCAEE0`).
- `REST_HEIGHT`, `MIN_SEGMENT_HEIGHT`, `MAX_SEGMENT_HEIGHT`, `MINUTES_AT_MAX` —
  the per-activity duration-to-height scale.
- `MAX_COLUMN_HEIGHT`, `SEGMENT_GAP` — cap and spacing for stacked same-day
  activities, so a column never exceeds the Figma vertical extent.

The frontend mirrors these tokens in
[`frontend/tailwind.config.js`](frontend/tailwind.config.js).

## API

- `GET /api/timeline` — derived per-day timeline `{date,type,color,minutes,height,isRest,count}`.
- `POST /api/refresh?full=false` — re-pull from Garmin and rebuild.
- `GET /api/config` — color + height-scale config.
- `GET /api/health` — status + cached activity count.
