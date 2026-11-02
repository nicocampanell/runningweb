import timelineData from "./timeline.json";

export interface ActivitySegment {
  type: string | null;
  bucket: string;
  color: string;
  minutes: number;
  height: number;
  distanceMi: number | null;
  distanceM?: number | null; // rowing only, exact meters
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

// Frozen Garmin history (2024-12-25 through 2025-09-30). The Python export that
// built it was removed; it lives in git history if the data ever needs a refresh.
export const timeline = timelineData as TimelineResponse;
