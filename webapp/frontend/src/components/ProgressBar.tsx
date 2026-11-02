interface ProgressBarProps {
  progress: number; // 0..1 horizontal scroll position
  total: number; // full array length, so every entry gets a tick
}

const TRACK_WIDTH = 204;
const THUMB_WIDTH = 48;
const TICK_PITCH = 7; // 1px tick + 6px gap
// Max ticks that physically fit inside the track.
const MAX_TICKS = Math.floor((TRACK_WIDTH + TICK_PITCH - 1) / TICK_PITCH);
// Ticks are brightest beside the thumb and fade out over this distance.
const FADE_DISTANCE = 110;
const MIN_TICK_OPACITY = 0.12;

export default function ProgressBar({ progress, total }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const left = clamped * (TRACK_WIDTH - THUMB_WIDTH);
  const ticks = Math.min(Math.max(total, 1), MAX_TICKS);
  const firstTickX = (TRACK_WIDTH - (ticks * TICK_PITCH - (TICK_PITCH - 1))) / 2;
  const thumbCenter = left + THUMB_WIDTH / 2;

  return (
    <div
      className="relative h-[32px]"
      style={{ width: TRACK_WIDTH }}
      aria-hidden
    >
      {/* Decorative tick marks, centered in the track */}
      <div className="absolute inset-0 flex items-center justify-center gap-[6px]">
        {Array.from({ length: ticks }).map((_, i) => {
          const distance = Math.abs(firstTickX + i * TICK_PITCH + 0.5 - thumbCenter);
          const opacity = Math.max(MIN_TICK_OPACITY, 1 - distance / FADE_DISTANCE);
          return (
            <div key={i} className="h-[16px] w-[1px] shrink-0 bg-ink" style={{ opacity }} />
          );
        })}
      </div>
      {/* Moving thumb */}
      <div
        className="absolute left-0 top-1/2 h-[24px] border border-ink/60 bg-canvas will-change-transform"
        style={{ width: THUMB_WIDTH, transform: `translate(${left}px, -50%)` }}
      />
    </div>
  );
}
