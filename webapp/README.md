# Workout Equalizer — "chasing something"

A personal data-art site that renders Garmin activity history (Dec 2024 – Sep 2025)
as a horizontal equalizer of vertical lines:

- **Color** encodes the workout type; **height** scales with duration.
- **Multiple activities in a day** stack as separate segments; rest days are short grey lines.
- **Selecting a day** (hover with a mouse, or the center line on touch) shows a
  liquid-glass card with sport icons, distance, and pace.

It is a static Vite + React + TypeScript + Tailwind app. The data is frozen in
`frontend/src/timeline.json`; there is no backend.

## Run locally

```bash
cd webapp/frontend
npm install
npm run dev     # http://localhost:5173
npm test
```

## Deploy (Vercel)

Import the repo with root directory `webapp/frontend` (Vite preset, `npm run build`,
output `dist`). `vercel.json` already sets this up.

## Portfolio (nicocampanell.me/run)

The portfolio serves a copy of the build from `public/run/`, with a `beforeFiles`
rewrite of `/run` to `/run/index.html` in its `next.config.ts`. After changing the app, rebuild into it:

```bash
cd webapp/frontend
npx vite build --base=/run/ --outDir ~/Documents/Portfolio/public/run --emptyOutDir
```
