import { describe, expect, it } from "vitest";
import { timeline } from "./api";

describe("static timeline", () => {
  it("is one contiguous run of days ending 2025-09-30", () => {
    const days = timeline.timeline;
    expect(days[days.length - 1].date).toBe("2025-09-30");
    for (let i = 1; i < days.length; i++) {
      const gap = Date.parse(days[i].date) - Date.parse(days[i - 1].date);
      expect(gap, days[i].date).toBe(86_400_000);
    }
    expect(days.every((d) => d.segments.length > 0)).toBe(true);
  });
});
