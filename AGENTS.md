## Learned User Preferences
- When executing an attached or previously created plan, do not edit the plan file, do not recreate existing todos, and mark the existing todos in progress as work starts.
- For the workout equalizer UI, preserve exact visual behavior the user asks for: pixel-level spacing, centering, hover effects, and bar lengths should be adjusted directly rather than approximated.

## Learned Workspace Facts
- The repository is only the `webapp/frontend` Workout Equalizer: a static Vite React TypeScript Tailwind app deployed on Vercel. The python-garminconnect fork, FastAPI backend, Render config, and raw Garmin cache were removed (recoverable from git history).
- All data is frozen in `webapp/frontend/src/timeline.json` (2024-12-25 through 2025-09-30); rowing segments carry exact `distanceM` meters alongside `distanceMi`.
- The equalizer timeline groups activities by local calendar day, renders one segment per activity, uses grey rest-day lines, and scales workout heights proportionally to activity duration.
- The frontend visualization is split across components such as `Equalizer`, `WaveLine`, `ProgressBar`, `HoverCard`, `Totals`, and `SoundToggle` under `webapp/frontend/src/components/`.
- Selection is the hovered day when a mouse is present, otherwise the day at the scroller's center (touch); the scroller is padded by half its width so the first and last days can reach the center.
- Local development is `npm run dev` in `webapp/frontend` (Vite on port 5173).
