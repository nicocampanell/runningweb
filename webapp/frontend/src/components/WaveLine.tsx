import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TimelineDay } from "../api";
import HoverCard from "./HoverCard";

// The visible bar is 2px wide; the hitbox spans the full column pitch
// (2px bar + 4px spacing) so there is 3x more room to hover.
export const COLUMN_PITCH = 6;

export interface HoverTarget {
  x: number; // viewport x of the column center
  top: number; // viewport y of the top of the bar stack
  height: number; // total height of the bar stack
  color: string; // color of the dominant (longest) segment
}

interface WaveLineProps {
  day: TimelineDay;
  columnHeight: number;
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (target: HoverTarget | null, date?: string) => void;
}

function WaveLineComponent({
  day,
  columnHeight,
  isHovered,
  isDimmed,
  onHoverChange,
}: WaveLineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const showCard = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Anchor the card above the top of the visible bar stack.
    const stack = el.querySelector("[data-stack]") as HTMLElement | null;
    const stackRect = stack ? stack.getBoundingClientRect() : r;
    const centerX = r.left + r.width / 2;
    setAnchor({ x: centerX, y: stackRect.top });

    const dominant = day.segments.reduce((a, b) =>
      b.minutes > a.minutes ? b : a
    );
    onHoverChange({
      x: centerX,
      top: stackRect.top,
      height: stackRect.height,
      color: dominant.color,
    }, day.date);
  };

  const hideCard = () => {
    setAnchor(null);
    onHoverChange(null);
  };

  return (
    <div
      ref={ref}
      className="relative flex shrink-0 flex-col items-center justify-center"
      style={{ height: columnHeight, width: COLUMN_PITCH }}
      onMouseEnter={showCard}
      onMouseLeave={hideCard}
    >
      {/* Stacked activity segments, 2px vertical gap between them. */}
      <div
        data-stack
        className="flex flex-col items-center gap-[2px] transition-opacity duration-150 ease-out"
        style={{ opacity: isDimmed ? 0.7 : 1 }}
      >
        {day.segments.map((seg, i) => (
          <div
            key={i}
            className="rounded-full transition-[width] duration-150 ease-out"
            style={{
              height: seg.height,
              width: isHovered ? 4 : 2,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>

      {/* Rendered via portal + fixed positioning so it is never clipped by the
          horizontally-scrolling equalizer container. */}
      {anchor &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full pb-2"
            style={{ left: anchor.x, top: anchor.y - 6 }}
          >
            <HoverCard day={day} />
          </div>,
          document.body
        )}
    </div>
  );
}

export const WaveLine = memo(WaveLineComponent);
