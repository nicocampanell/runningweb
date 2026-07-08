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
  if (segment.distanceMi != null) {
    parts.push(`${segment.distanceMi} mi`);
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

export default function HoverCard({ day }: { day: TimelineDay }) {
  return (
    <div className="pointer-events-none flex flex-col items-start justify-center gap-[8px] rounded-[16px] bg-canvas px-[12px] py-[6px] font-mono drop-shadow-[0px_0px_2px_rgba(0,0,0,0.25)]">
      <p className="w-full text-center text-[12px] text-black">
        {formatDate(day.date)}
      </p>
      {day.segments.map((seg, i) => (
        <Row key={i} segment={seg} />
      ))}
    </div>
  );
}
