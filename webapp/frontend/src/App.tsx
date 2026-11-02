import { useState } from "react";
import Totals from "./components/Totals";
import Equalizer from "./components/Equalizer";
import ProgressBar from "./components/ProgressBar";
import SoundToggle from "./components/SoundToggle";
import { timeline as data } from "./api";

export default function App() {
  const [progress, setProgress] = useState(0);
  const [risen, setRisen] = useState(false);

  return (
    // Locked to the visible viewport: tall bars are clipped, never page-scrolled.
    <div className="relative flex h-dvh flex-col items-center overflow-hidden bg-canvas font-sans text-ink">
      {/* Frame matches the Figma MacBook Air: 1280 wide, 106px side padding
          (shrinking on smaller screens), so the equalizer scrolls within it. */}
      <div className="relative flex h-full w-full max-w-[1280px] flex-col items-center px-4 pb-[114px] pt-[113px] sm:px-10 lg:px-[106px]">
        <div className="absolute left-4 right-4 top-1/2 flex -translate-y-1/2 flex-col items-center sm:left-10 sm:right-10 lg:left-[106px] lg:right-[106px]">
          <Equalizer
            days={data.timeline}
            maxColumn={data.maxColumn}
            onProgress={setProgress}
            onRisen={() => setRisen(true)}
          />
        </div>

        {/* The chrome fades in together once the bars have risen, alongside
            the sprawl. Its children are fixed/absolute, so this wrapper takes
            no space. */}
        <div
          className={`transition-opacity duration-[385ms] ease-out ${risen ? "" : "pointer-events-none"}`}
          style={{ opacity: risen ? 1 : 0 }}
        >
          <Totals />
          <SoundToggle />
          <div className="absolute bottom-[56px] left-1/2 -translate-x-1/2">
            <ProgressBar progress={progress} total={data.timeline.length} />
          </div>
        </div>
      </div>
    </div>
  );
}
