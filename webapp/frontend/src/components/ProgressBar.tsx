interface ProgressBarProps {
  progress: number; // 0..1 horizontal scroll position
  total: number; // full array length, so every entry gets a tick
}

const TRACK_WIDTH = 204;
const THUMB_WIDTH = 48;
const TICK_PITCH = 7; // 1px tick + 6px gap
// Max ticks that physically fit inside the track.
const MAX_TICKS = Math.floor((TRACK_WIDTH + TICK_PITCH - 1) / TICK_PITCH);

export default function ProgressBar({ progress, total }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const left = clamped * (TRACK_WIDTH - THUMB_WIDTH);
  const ticks = Math.min(Math.max(total, 1), MAX_TICKS);

  return (
    <div
      className="relative h-[32px]"
      style={{ width: TRACK_WIDTH }}
      aria-hidden
    >
      {/* Decorative tick marks, centered in the track */}
      <div className="absolute inset-0 flex items-center justify-center gap-[6px]">
        {Array.from({ length: ticks }).map((_, i) => (
          <div key={i} className="h-[16px] w-[1px] shrink-0 bg-ink/40" />
        ))}
      </div>
      {/* Moving thumb */}
      <div
        className="absolute top-1/2 h-[24px] -translate-y-1/2 border border-ink/60 bg-canvas transition-[left] duration-100"
        style={{ width: THUMB_WIDTH, left }}
      />
    </div>
  );
}
