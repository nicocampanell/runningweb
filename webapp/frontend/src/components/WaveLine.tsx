import { memo } from "react";
import { TimelineDay } from "../api";

// The visible bar is 2px wide; the hitbox spans the full column pitch
// (2px bar + 4px spacing) so there is 3x more room to hover.
export const COLUMN_PITCH = 6;

export const REST_OPACITY = 0.2;
// Snap on instantly, fade back slowly: scrubbing leaves a decaying trail.
// The hover click's volume follows the same curve.
export const TRAIL_MS = 350;
const TRAIL = `${TRAIL_MS}ms ease-in-out`;

export interface HoverTarget {
  x: number; // viewport x of the column center
  top: number; // viewport y of the top of the dominant (longest) segment
  height: number; // height of the dominant segment
  color: string; // color of the dominant segment
}

interface WaveLineProps {
  day: TimelineDay;
  columnHeight: number;
  isHovered: boolean;
}

// Measures a column element (the WaveLine root) for the hover card and cursor.
export function hoverTargetFor(el: Element, day: TimelineDay): HoverTarget {
  const r = el.getBoundingClientRect();
  const stack = el.querySelector("[data-stack]");
  const stackRect = stack ? stack.getBoundingClientRect() : r;

  const dominant = day.segments.reduce(
    (best, s, i, all) => (s.minutes > all[best].minutes ? i : best),
    0
  );
  // Morph onto the dominant segment only, so its color never covers the others.
  const segRect =
    stack?.children[dominant]?.getBoundingClientRect() ?? stackRect;
  return {
    x: r.left + r.width / 2,
    top: segRect.top,
    height: segRect.height,
    color: day.segments[dominant].color,
  };
}

function WaveLineComponent({
  day,
  columnHeight,
  isHovered,
}: WaveLineProps) {
  return (
    <div
      data-date={day.date}
      className="relative flex shrink-0 flex-col items-center justify-center"
      style={{ height: columnHeight, width: COLUMN_PITCH }}
    >
      {/* Stacked activity segments, 2px vertical gap between them. */}
      <div
        data-stack
        className="flex flex-col items-center gap-[2px]"
        style={{
          opacity: isHovered ? 1 : REST_OPACITY,
          transition: isHovered ? "none" : `opacity ${TRAIL}`,
        }}
      >
        {day.segments.map((seg, i) => (
          <div
            key={i}
            className="w-[4px] rounded-full"
            style={{
              height: seg.height,
              backgroundColor: seg.color,
              transform: isHovered ? "none" : "scaleX(0.5)",
              transition: isHovered ? "none" : `transform ${TRAIL}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const WaveLine = memo(WaveLineComponent);
