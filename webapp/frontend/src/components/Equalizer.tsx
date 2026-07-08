import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TimelineDay } from "../api";
import { HoverTarget, WaveLine } from "./WaveLine";
import RunnerOverlay from "./RunnerOverlay";

const DOT_SIZE = 10; // idle cursor circle diameter

interface EqualizerProps {
  days: TimelineDay[];
  // Tallest possible column, from the backend, so the container matches exactly
  // and the tallest bars are never clipped.
  maxColumn: number;
  onProgress: (progress: number) => void;
}

export default function Equalizer({ days, maxColumn, onProgress }: EqualizerProps) {
  const COLUMN_HEIGHT = maxColumn;
  const CONTAINER_HEIGHT = maxColumn;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    onProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  // Start scrolled to the most recent day (right edge) once content is laid out.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    handleScroll();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  const handleHoverChange = useCallback((t: HoverTarget | null, date?: string) => {
    setTarget(t);
    setHoveredDate(t && date ? date : null);
  }, []);

  // Cursor morph: idle = small black circle following the mouse; over a bar it
  // snaps onto the line's shape and its color transitions from black through a
  // blend into the segment's full color.
  const cursorStyle: React.CSSProperties = target
    ? {
        left: target.x - 1,
        top: target.top,
        width: 2,
        height: target.height,
        borderRadius: 2,
        backgroundColor: target.color,
      }
    : {
        left: (mouse?.x ?? 0) - DOT_SIZE / 2,
        top: (mouse?.y ?? 0) - DOT_SIZE / 2,
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: 9999,
        backgroundColor: "#000",
      };

  return (
    <div
      className="relative w-full cursor-none"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => {
        setMouse(null);
        setTarget(null);
        setHoveredDate(null);
      }}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="equalizer-scroll flex items-center overflow-x-auto overflow-y-hidden"
        style={{ height: CONTAINER_HEIGHT }}
      >
        {days.map((day) => (
          <WaveLine
            key={day.date}
            day={day}
            columnHeight={COLUMN_HEIGHT}
            isHovered={hoveredDate === day.date}
            isDimmed={hoveredDate !== null && hoveredDate !== day.date}
            onHoverChange={handleHoverChange}
          />
        ))}
      </div>
      <RunnerOverlay />

      {mouse &&
        createPortal(
          <div
            className="pointer-events-none fixed z-40"
            style={{
              ...cursorStyle,
              transition:
                "width 120ms ease, height 120ms ease, border-radius 120ms ease, background-color 120ms ease, left 60ms ease-out, top 60ms ease-out",
            }}
          />,
          document.body
        )}
    </div>
  );
}
