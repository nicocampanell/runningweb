import { useCallback, useEffect, useState } from "react";
import { fetchTimeline, refreshTimeline, TimelineResponse } from "../api";

interface UseTimelineState {
  data: TimelineResponse | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: (full?: boolean) => Promise<void>;
}

export function useTimeline(): UseTimelineState {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    fetchTimeline()
      .then((res) => active && setData(res))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async (full = false) => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await refreshTimeline(full);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { data, loading, error, refreshing, refresh };
}
