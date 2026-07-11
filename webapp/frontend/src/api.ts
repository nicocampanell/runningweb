export interface ActivitySegment {
  type: string | null;
  bucket: string;
  color: string;
  minutes: number;
  height: number;
  distanceMi: number | null;
  pace: string | null;
  durationLabel: string;
}

export interface TimelineDay {
  date: string;
  isRest: boolean;
  count: number;
  totalMinutes: number;
  segments: ActivitySegment[];
}

export interface TimelineResponse {
  count: number;
  restDays: number;
  workoutDays: number;
  maxColumn: number;
  today: string;
  lastDate: string;
  timeline: TimelineDay[];
}

const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchTimeline(): Promise<TimelineResponse> {
  const res = await fetch(`${BASE}/api/timeline`);
  if (!res.ok) {
    throw new Error(`Failed to load timeline (${res.status})`);
  }
  return res.json();
}

export async function refreshTimeline(full = false): Promise<TimelineResponse> {
  const res = await fetch(`${BASE}/api/refresh?full=${full}`, {
    method: "POST",
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Refresh failed (${res.status}): ${detail}`);
  }
  return res.json();
}
