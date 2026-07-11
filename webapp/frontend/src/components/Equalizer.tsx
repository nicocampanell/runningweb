import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TimelineDay } from "../api";
import { COLUMN_PITCH, HoverTarget, WaveLine } from "./WaveLine";
import RunnerOverlay from "./RunnerOverlay";

const DOT_SIZE = 10; // idle cursor circle diameter
const INTRO_COLUMN_COUNT = 10;
const INTRO_WIDTH = INTRO_COLUMN_COUNT * COLUMN_PITCH;

type IntroPhase = "enter" | "rise" | "sprawl" | "done";

interface EqualizerProps {
  days: TimelineDay[];
  // Tallest possible column, from the backend, so the container matches exactly
  // and the tallest bars are never clipped.
  maxColumn: number;
  onProgress: (progress: number) => void;
  onIntroComplete?: () => void;
}

export default function Equalizer({
  days,
  maxColumn,
  onProgress,
  onIntroComplete,
}: EqualizerProps) {
  const COLUMN_HEIGHT = maxColumn;
  const CONTAINER_HEIGHT = maxColumn;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("enter");
  const shellRef = useRef<HTMLDivElement>(null);
  const riseHandledRef = useRef(false);
  const introCompleteRef = useRef(onIntroComplete);
  introCompleteRef.current = onIntroComplete;

  const isAnimating = introPhase !== "done";

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIntroPhase("done");
      introCompleteRef.current?.();
      return;
    }

    const id = requestAnimationFrame(() => setIntroPhase("rise"));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (introPhase !== "done") return;
    introCompleteRef.current?.();
  }, [introPhase]);

  const handleShellTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== shellRef.current) return;
    if (introPhase === "rise" && e.propertyName === "transform" && !riseHandledRef.current) {
      riseHandledRef.current = true;
      setIntroPhase("sprawl");
    }
    if (introPhase === "sprawl" && e.propertyName === "width") {
      setIntroPhase("done");
    }
  };

  // Keep the leftmost-day cluster visible while the shell widens during sprawl.
  useLayoutEffect(() => {
    if (introPhase !== "sprawl") return;
    const el = scrollRef.current;
    const shell = shellRef.current;
    if (!el || !shell) return;

    const pinScroll = () => {
      el.scrollLeft = 0;
      handleScroll();
    };

    pinScroll();
    const observer = new ResizeObserver(pinScroll);
    observer.observe(shell);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPhase]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    onProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  // Pin to the left edge during intro and when the animation completes.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    handleScroll();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPhase]);

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
      className={`relative w-full ${isAnimating ? "pointer-events-none" : "cursor-none"}`}
      onMouseMove={(e) => !isAnimating && setMouse({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => {
        setMouse(null);
        setTarget(null);
        setHoveredDate(null);
      }}
    >
      <div
        ref={shellRef}
        className="equalizer-opening-shell"
        data-phase={introPhase}
        style={{ "--intro-width": `${INTRO_WIDTH}px` } as React.CSSProperties}
        onTransitionEnd={handleShellTransitionEnd}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={`equalizer-scroll flex items-center overflow-y-hidden ${
            isAnimating ? "overflow-x-hidden" : "overflow-x-auto"
          }`}
          style={{ height: CONTAINER_HEIGHT }}
        >
          {days.map((day) => (
            <WaveLine
              key={day.date}
              day={day}
              columnHeight={COLUMN_HEIGHT}
              isHovered={!isAnimating && hoveredDate === day.date}
              isDimmed={!isAnimating && hoveredDate !== null && hoveredDate !== day.date}
              onHoverChange={isAnimating ? () => {} : handleHoverChange}
            />
          ))}
        </div>
      </div>
      <RunnerOverlay />

      {mouse && !isAnimating &&
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
