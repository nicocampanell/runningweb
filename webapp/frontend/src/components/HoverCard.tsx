import { useLayoutEffect, useRef, useState } from "react";
import { ActivitySegment, TimelineDay } from "../api";
import SportIcon from "./SportIcon";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}/${y}`;
}

function Dot() {
  return <span className="h-[4px] w-[4px] shrink-0 rounded-full bg-secondary" />;
}

function Row({ segment }: { segment: ActivitySegment }) {
  const parts: string[] = [];
  if (segment.distanceM != null || segment.distanceMi != null) {
    parts.push(
      segment.distanceM != null
        ? `${segment.distanceM.toLocaleString()} m`
        : `${segment.distanceMi} mi`
    );
    if (segment.pace) parts.push(segment.pace);
  } else {
    parts.push(segment.durationLabel);
  }

  return (
    <div className="flex items-center justify-center gap-[8px]">
      <span className="shrink-0 text-secondary">
        <SportIcon bucket={segment.bucket} size={24} />
      </span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-[8px]">
          <Dot />
          <span className="whitespace-nowrap text-[12px] text-secondary">{p}</span>
        </span>
      ))}
    </div>
  );
}

// Damped-spring progress (0 -> 1, overshooting when bounce > 0) sampled at
// 60fps until settled, using Apple's duration/bounce parametrization.
export function springSamples(bounce: number, duration: number) {
  const w = (2 * Math.PI) / duration;
  const z = 1 - bounce;
  const wd = w * Math.sqrt(1 - z * z);
  const settle = Math.log(1000) / (z * w);
  const n = Math.ceil(settle * 60);
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * settle;
    const e = Math.exp(-z * w * t);
    return 1 - e * (wd ? Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t) : 1 + w * t);
  });
  samples[n] = 1;
  return { ms: settle * 1000, samples };
}

// How fast the selection is sweeping, in days per second, smoothed across
// changes. Mouse moves and wheel scrolls both land here as day changes.
const sweep = { date: "", at: 0, speed: 0, energy: 0 };
function energyFor(date: string): number {
  if (date === sweep.date) return sweep.energy; // StrictMode double render
  const now = performance.now();
  const dt = now - sweep.at;
  const days = sweep.date ? Math.abs(Date.parse(date) - Date.parse(sweep.date)) / 86_400_000 : 0;
  const instant = (days / Math.max(dt, 8)) * 1000;
  sweep.speed = dt > 300 ? instant : sweep.speed * 0.5 + instant * 0.5;
  // 6 days/s (a slow scrub) -> 0, 180 days/s (a flick) -> 1, on a log scale.
  sweep.energy = Math.min(1, Math.max(0, Math.log(sweep.speed / 6) / Math.log(30)));
  Object.assign(sweep, { date, at: now });
  return sweep.energy;
}

function Content({
  day,
  className,
  dir,
  energy,
}: {
  day: TimelineDay;
  className: string;
  dir: number;
  energy?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Faster sweeps enter from farther away and settle with more bounce: a slow
  // scrub glides in with none, a flick peaks at ~12% overshoot.
  useLayoutEffect(() => {
    const el = ref.current;
    if (energy == null || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { ms, samples } = springSamples(0.585 * energy, 0.3 + 0.1 * energy);
    const from = -dir * (8 + 20 * energy);
    const anim = el.animate(
      samples.map((p) => ({ transform: `translateX(${from * (1 - p)}px)` })),
      { duration: ms, easing: "linear" }
    );
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={`flex flex-col items-start justify-center gap-[8px] px-[14px] py-[10px] ${className}`}
      style={{ "--dir": dir } as React.CSSProperties}
    >
      <p className="w-full text-center text-[13px] font-semibold tracking-[-0.01em] text-black">
        {formatDate(day.date)}
      </p>
      {day.segments.map((seg, i) => (
        <Row key={i} segment={seg} />
      ))}
    </div>
  );
}

// Text rolls sideways in the direction of travel: moving forward in time, the
// old day slides out to the right while the new one slides in from the left.
export default function HoverCard({ day }: { day: TimelineDay }) {
  const [shown, setShown] = useState({ day, prev: null as TimelineDay | null, dir: 1, energy: 0 });
  if (shown.day !== day) {
    setShown({
      day,
      prev: shown.day,
      dir: day.date > shown.day.date ? 1 : -1,
      energy: energyFor(day.date),
    });
  }

  return (
    <div className="liquid-glass pointer-events-none relative overflow-hidden rounded-[20px] font-sf tabular-nums antialiased">
      {shown.prev && (
        <Content
          key={`out-${shown.prev.date}`}
          day={shown.prev}
          dir={shown.dir}
          className="card-roll-out absolute inset-0"
        />
      )}
      <Content
        key={day.date}
        day={day}
        dir={shown.dir}
        energy={shown.energy}
        className="card-roll-in"
      />
    </div>
  );
}
