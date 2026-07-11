import { useState } from "react";
import Title from "./components/Title";
import Equalizer from "./components/Equalizer";
import ProgressBar from "./components/ProgressBar";
import { useTimeline } from "./hooks/useTimeline";

export default function App() {
  const { data, loading, error, refreshing, refresh } = useTimeline();
  const [progress, setProgress] = useState(0);
  const [introDone, setIntroDone] = useState(false);

  const hasData = data && data.timeline.length > 0;

  return (
    <div className="relative flex min-h-full flex-col items-center bg-canvas font-sans text-ink">
      {/* Subtle refresh control */}
      <button
        onClick={() => refresh(false)}
        disabled={refreshing}
        className="absolute right-6 top-6 z-40 rounded-full border border-ink/20 px-3 py-1 text-[12px] text-ink/70 transition hover:border-ink/40 hover:text-ink disabled:opacity-40"
      >
        {refreshing ? "syncing…" : "sync"}
      </button>

      {/* Frame matches the Figma MacBook Air: 1280 wide, 106px side padding, so
          the equalizer never extends past the design and scrolls within it. */}
      <div className="relative flex min-h-screen w-full max-w-[1280px] flex-col items-center px-[106px] pb-[114px] pt-[113px]">
        <Title />

        {loading && (
          <p className="text-[14px] text-ink/50">loading your history…</p>
        )}

        {error && !loading && (
          <div className="max-w-md text-center text-[14px] text-swim">{error}</div>
        )}

        {!loading && !error && !hasData && (
          <div className="max-w-md text-center text-[14px] text-ink/60">
            No activities cached yet. Run{" "}
            <code className="rounded bg-ink/10 px-1">python export.py</code> in the
            backend, then hit sync.
          </div>
        )}

        {hasData && (
          <div className="absolute left-[106px] right-[106px] top-1/2 flex -translate-y-1/2 flex-col items-center">
            <Equalizer
              days={data.timeline}
              maxColumn={data.maxColumn}
              onProgress={setProgress}
              onIntroComplete={() => setIntroDone(true)}
            />
          </div>
        )}

        {hasData && (
          <div
            className="absolute bottom-[56px] transition-opacity duration-500 ease-out"
            style={{ opacity: introDone ? 1 : 0 }}
          >
            <ProgressBar progress={progress} total={data.timeline.length} />
          </div>
        )}
      </div>
    </div>
  );
}
