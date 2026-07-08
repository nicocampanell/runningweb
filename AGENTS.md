## Learned User Preferences
- When executing an attached or previously created plan, do not edit the plan file, do not recreate existing todos, and mark the existing todos in progress as work starts.
- For the workout equalizer UI, preserve exact visual behavior the user asks for: pixel-level spacing, centering, hover effects, and bar lengths should be adjusted directly rather than approximated.

## Learned Workspace Facts
- The repository now includes a `webapp/` Workout Equalizer app with a FastAPI backend and a Vite React TypeScript Tailwind frontend.
- The webapp backend uses `python-garminconnect` to fetch lifetime Garmin activities, caches personal activity data at `webapp/data/activities.json`, and exposes `/api/timeline`, `/api/refresh`, `/api/config`, and `/api/health`.
- Garmin lifetime activity pulls should use `Garmin.get_activities_by_date(start, end, sortorder="asc")`; activity type comes from `activityType.typeKey`, start time from `startTimeLocal`, and duration is measured in seconds.
- The equalizer timeline groups activities by local calendar day, renders one segment per activity, uses grey rest-day lines, and currently scales workout heights proportionally to activity duration.
- The frontend visualization is split across components such as `Equalizer`, `WaveLine`, `ProgressBar`, `HoverCard`, `RunnerOverlay`, and `Title` under `webapp/frontend/src/components/`.
- Local development convention is Vite on port 5173 proxying to the FastAPI backend on port 8000; Garmin refreshes may require the backend to run with unrestricted network access in sandboxed agent sessions.
