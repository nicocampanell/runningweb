import { timeline } from "../api";

const STRAVA_URL = "https://www.strava.com/athletes/129173185";

const days = timeline.timeline;
const hours = Math.round(days.reduce((sum, d) => sum + d.totalMinutes, 0) / 60);
const miles = Math.round(
  days.reduce(
    (sum, d) => sum + d.segments.reduce((s, seg) => s + (seg.distanceMi ?? 0), 0),
    0
  )
);

export default function Totals() {
  return (
    <a
      href={STRAVA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="totals-link fixed left-1/2 top-[62px] z-40 -translate-x-1/2 flex items-center text-[14px] leading-none text-ink"
    >
      <span className="totals-underline flex gap-2 whitespace-nowrap pb-[3px] tabular-nums">
        <span>{hours.toLocaleString()} hrs</span>
        <span aria-hidden="true">·</span>
        <span>{miles.toLocaleString()} mi</span>
      </span>
      <span className="sr-only">, view on Strava</span>
      {/* Out of flow so the numbers, not numbers + arrow, sit on center. */}
      <img src={`${import.meta.env.BASE_URL}arrow.svg`} alt="" className="totals-arrow absolute left-full ml-2 h-[10px] w-[10px]" />
    </a>
  );
}
