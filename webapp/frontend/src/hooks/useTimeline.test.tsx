// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTimeline } from "../api";
import type { TimelineResponse } from "../api";
import { useTimeline } from "./useTimeline";

vi.mock("../api", () => ({
  fetchTimeline: vi.fn(),
  refreshTimeline: vi.fn(),
}));

const initialResponse: TimelineResponse = {
  count: 1,
  restDays: 1,
  workoutDays: 0,
  maxColumn: 900,
  today: "2026-07-09",
  lastDate: "2026-07-09",
  timeline: [],
};

const polledResponse: TimelineResponse = {
  count: 2,
  restDays: 1,
  workoutDays: 1,
  maxColumn: 1200,
  today: "2026-07-10",
  lastDate: "2026-07-10",
  timeline: [
    {
      date: "2026-07-10",
      isRest: false,
      count: 1,
      totalMinutes: 20,
      segments: [],
    },
  ],
};

describe("useTimeline polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetchTimeline).mockResolvedValue(initialResponse);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("loads the timeline on mount", async () => {
    const { result } = renderHook(() => useTimeline());

    expect(result.current.loading).toBe(true);

    await act(async () => {});

    expect(fetchTimeline).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(initialResponse);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("fetches the cached timeline again after five minutes", async () => {
    renderHook(() => useTimeline());
    await act(async () => {});

    expect(fetchTimeline).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(fetchTimeline).toHaveBeenCalledTimes(2);
  });

  it("replaces timeline data after a successful poll", async () => {
    vi.mocked(fetchTimeline)
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValueOnce(polledResponse);
    const { result } = renderHook(() => useTimeline());
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current.data).toEqual(polledResponse);
    expect(result.current.error).toBeNull();
  });

  it("preserves timeline data and error state when polling fails", async () => {
    vi.mocked(fetchTimeline)
      .mockResolvedValueOnce(initialResponse)
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTimeline());
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(result.current.data).toEqual(initialResponse);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("stops polling after unmount", async () => {
    const { unmount } = renderHook(() => useTimeline());
    await act(async () => {});

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });

    expect(fetchTimeline).toHaveBeenCalledTimes(1);
  });
});
