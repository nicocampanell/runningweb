import { CSSProperties, useEffect, useState } from "react";
import { setSoundOn } from "./Equalizer";

export default function SoundToggle() {
  // Odd = on. Counting toggles lets the slash's dash offset keep moving
  // forward (one 1.1 half-period per toggle, see .sound-slash), so it always
  // draws in from the top and exits off the bottom.
  const [toggles, setToggles] = useState(() => (localStorage.getItem("sound") === "off" ? 0 : 1));
  const on = toggles % 2 === 1;

  useEffect(() => {
    setSoundOn(on);
    localStorage.setItem("sound", on ? "on" : "off");
  }, [on]);

  return (
    <button
      type="button"
      aria-label="Sound"
      aria-pressed={on}
      data-on={on}
      onClick={() => setToggles((n) => n + 1)}
      className="totals-link sound-toggle fixed right-[17px] top-[53px] z-40 p-[7px] text-ink"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ "--slash": -1.1 * toggles } as CSSProperties}
      >
        <path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5" />
        <path className="sound-wave sound-wave-1" d="M15 8a5 5 0 0 1 0 8" />
        <path className="sound-wave sound-wave-2" d="M17.7 5a9 9 0 0 1 0 14" />
        <path className="sound-slash" d="M2 5l13 13" pathLength="1" stroke="#f2f5f8" strokeWidth="4.5" />
        <path className="sound-slash" d="M2 5l13 13" pathLength="1" />
      </svg>
    </button>
  );
}
