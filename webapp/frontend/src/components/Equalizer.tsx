import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TimelineDay } from "../api";
import {
  COLUMN_PITCH,
  HoverTarget,
  REST_OPACITY,
  TRAIL_MS,
  WaveLine,
  hoverTargetFor,
} from "./WaveLine";
import HoverCard from "./HoverCard";

const DOT_SIZE = 10; // idle cursor circle diameter
// Bars only respond between the top row's top edge and the progress thumb's
// bottom edge, both this far from the viewport edge (see Totals, SoundToggle,
// and App's progress bar placement).
const EDGE_MARGIN = 60;

const CLICK_VOLUME = 0.2;

// CSS ease-in-out, cubic-bezier(0.42, 0, 0.58, 1), resampled on even time steps.
function easeInOut(points: number): number[] {
  const bez = (a: number, b: number, u: number) =>
    3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 256; i++) {
    xs.push(bez(0.42, 0.58, i / 256));
    ys.push(bez(0, 1, i / 256));
  }
  return Array.from({ length: points }, (_, i) => {
    const x = i / (points - 1);
    const j = Math.max(1, xs.findIndex((v) => v >= x));
    return ys[j - 1] + ((x - xs[j - 1]) / (xs[j] - xs[j - 1])) * (ys[j] - ys[j - 1]);
  });
}

const EASE = easeInOut(64);

// Volume mirrors a line's opacity: full on hover, then easing back to the rest
// level over the trail, so a fast scrub leaves a decaying trail of clicks.
const CLICK_ENVELOPE = Float32Array.from(EASE, (e) => CLICK_VOLUME * (1 - (1 - REST_OPACITY) * e));

// Each new click eases the previous one out to silence along the same curve.
// The faster clicks arrive, the sooner the old one cuts and the softer the new
// one plays, so fast scrubbing stays a light tick instead of a harsh roar.
const DUCK_MS = 40;
const CALM_MS = 120; // clicks spaced at least this far apart play at full volume
const BUSY_VOLUME = 0.35; // volume scale for back-to-back clicks
let lastVoice: GainNode | null = null;
let lastClickAt = -Infinity;

type ClickAudio = { ctx: AudioContext; buf?: AudioBuffer };
let audio: ClickAudio | null = null;
function getAudio(): ClickAudio {
  if (!audio) {
    const a: ClickAudio = { ctx: new AudioContext() };
    audio = a;
    fetch(`${import.meta.env.BASE_URL}click.wav`)
      .then((r) => r.arrayBuffer())
      .then((b) => a.ctx.decodeAudioData(b))
      .then((buf) => (a.buf = buf))
      .catch(() => {});
  }
  return audio;
}

// Browsers keep audio suspended until a click or keypress on the page; hover
// doesn't count, so unlock on the first one.
const unlockAudio = () => getAudio().ctx.resume().catch(() => {});
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

let soundOn = true;
export const setSoundOn = (on: boolean) => {
  soundOn = on;
};

function playClick() {
  if (!soundOn) return;
  const { ctx, buf } = getAudio();
  if (!buf || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const calm = Math.min(1, ((now - lastClickAt) * 1000) / CALM_MS);
  lastClickAt = now;
  if (lastVoice) {
    const prev = lastVoice.gain;
    const from = prev.value;
    prev.cancelScheduledValues(now);
    prev.setValueCurveAtTime(
      Float32Array.from(EASE, (e) => from * (1 - e)),
      now,
      Math.max(0.003, (DUCK_MS * calm) / 1000),
    );
  }
  const level = BUSY_VOLUME + (1 - BUSY_VOLUME) * calm;
  const gain = ctx.createGain();
  gain.gain.setValueCurveAtTime(
    Float32Array.from(CLICK_ENVELOPE, (v) => v * level),
    now,
    TRAIL_MS / 1000,
  );
  gain.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(gain);
  src.start();
  lastVoice = gain;
}
const INTRO_COLUMN_COUNT = 10;
const INTRO_WIDTH = INTRO_COLUMN_COUNT * COLUMN_PITCH;

type IntroPhase = "enter" | "rise" | "sprawl" | "done";

interface EqualizerProps {
  days: TimelineDay[];
  // Tallest possible column, from the backend, so the container matches exactly
  // and the tallest bars are never clipped.
  maxColumn: number;
  onProgress: (progress: number) => void;
  // Fires once the opening rise lands, as the sprawl begins.
  onRisen?: () => void;
}

export default function Equalizer({
  days,
  maxColumn,
  onProgress,
  onRisen,
}: EqualizerProps) {
  const COLUMN_HEIGHT = maxColumn;
  const CONTAINER_HEIGHT = maxColumn;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const [hoveredDay, setHoveredDay] = useState<TimelineDay | null>(null);
  const [byMouse, setByMouse] = useState(false);
  const [introPhase, setIntroPhase] = useState<IntroPhase>("enter");
  const shellRef = useRef<HTMLDivElement>(null);
  const riseHandledRef = useRef(false);
  const risenRef = useRef(onRisen);
  risenRef.current = onRisen;

  const isAnimating = introPhase !== "done";

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIntroPhase("done");
      return;
    }

    const id = requestAnimationFrame(() => setIntroPhase("rise"));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (introPhase === "sprawl" || introPhase === "done") risenRef.current?.();
  }, [introPhase]);

  const handleShellTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== shellRef.current) return;
    if (introPhase === "rise" && e.propertyName === "transform" && !riseHandledRef.current) {
      riseHandledRef.current = true;
      setIntroPhase("sprawl");
    }
    if (introPhase === "sprawl" && e.propertyName === "clip-path") {
      setIntroPhase("done");
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    onProgress(max > 0 ? el.scrollLeft / max : 0);

    // Scrolling slides columns under a still cursor without firing mouseenter.
    if (!isAnimating) syncSelection(mouse);
  };

  // With a mouse, the column under the cursor is the selection (none when off
  // the columns or in the top/bottom margins). Without one (touch), the day at
  // the scroller's center is.
  const syncSelection = (point: { x: number; y: number } | null) => {
    const el = scrollRef.current;
    if (!el) return;
    const inBand = point && point.y >= EDGE_MARGIN && point.y <= window.innerHeight - EDGE_MARGIN;
    const hovered = inBand && document.elementFromPoint(point.x, point.y)?.closest("[data-date]");
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const centerIndex = Math.round(el.scrollLeft / COLUMN_PITCH);
    const col = hasMouse
      ? hovered
      : el.children[Math.min(days.length - 1, Math.max(0, centerIndex))];
    const day = col ? days.find((d) => d.date === col.getAttribute("data-date")) : undefined;
    handleHoverChange(col && day ? hoverTargetFor(col, day) : null, day, !!hovered);
  };

  // The scroller is padded by half its width on each side, so scrollLeft 0 puts
  // the first day at the center; the timeline starts there and expands right.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    handleScroll();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introPhase]);

  // Wheel and trackpad (either axis) scroll the timeline horizontally at 80%
  // speed for a bit of friction. Needs a non-passive listener to stop the page
  // itself from scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isAnimating) return;
    let carry = 0; // sub-pixel remainder, so small trackpad deltas aren't rounded away
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      carry += (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? d * 16 : d) * 0.8;
      const step = Math.trunc(carry);
      el.scrollLeft += step;
      carry -= step;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isAnimating]);

  // The dot replaces the system cursor page-wide, not just over the bars, and
  // steps aside for the native pointer over links and buttons.
  useEffect(() => {
    if (isAnimating) return;
    const root = document.documentElement;
    root.classList.add("cursor-none");
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const overControl = (e.target as Element).closest?.("a, button");
      const point = overControl ? null : { x: e.clientX, y: e.clientY };
      setMouse(point);
      syncSelection(point);
    };
    const onLeave = () => {
      setMouse(null);
      syncSelection(null);
    };
    window.addEventListener("pointermove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.classList.remove("cursor-none");
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating]);

  const lastDateRef = useRef<string | null>(null);
  const handleHoverChange = useCallback(
    (t: HoverTarget | null, day?: TimelineDay, fromMouse = true) => {
      const date = t && day ? day.date : null;
      if (date && date !== lastDateRef.current) playClick();
      lastDateRef.current = date;
      setTarget(t);
      setHoveredDay(t && day ? day : null);
      setByMouse(fromMouse);
    },
    []
  );

  // Cursor morph: idle = small black circle following the mouse; over a bar it
  // snaps onto the line's shape and its color transitions from black through a
  // blend into the segment's full color.
  const cursorStyle: React.CSSProperties = target && byMouse
    ? {
        left: target.x - 2,
        top: target.top,
        width: 4,
        height: target.height,
        borderRadius: 9999,
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
    <div className={`relative w-full ${isAnimating ? "pointer-events-none" : ""}`}>
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
          style={{ height: CONTAINER_HEIGHT, paddingInline: `calc(50% - ${COLUMN_PITCH / 2}px)` }}
        >
          {days.map((day) => (
            <WaveLine
              key={day.date}
              day={day}
              columnHeight={COLUMN_HEIGHT}
              isHovered={!isAnimating && hoveredDay?.date === day.date}
            />
          ))}
        </div>
      </div>

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

      {/* One persistent card: fixed height slightly above page center, following
          the selected day horizontally, so its content animates between days. */}
      {target && hoveredDay &&
        createPortal(
          <div
            className="pointer-events-none fixed top-[40%] z-50 -translate-x-1/2 -translate-y-1/2"
            style={{ left: target.x }}
          >
            <HoverCard day={hoveredDay} />
          </div>,
          document.body
        )}
    </div>
  );
}
