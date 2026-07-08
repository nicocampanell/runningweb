interface SportIconProps {
  bucket: string;
  size?: number;
  className?: string;
}

// Minimal 24x24 line icons (stroke = currentColor) in the spirit of the
// Fluent "sport_*" glyphs used in the Figma hover cards.
const PATHS: Record<string, JSX.Element> = {
  run: (
    <>
      <circle cx="15.5" cy="5" r="1.8" />
      <path d="M13.5 8.5 9.5 11l2.5 2 .5 4" />
      <path d="M12.5 13 15 15l3 1" />
      <path d="M12 17l-2.5 4" />
      <path d="M9.5 11l-3 1-1.5-2.5" />
    </>
  ),
  walk: (
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M12.5 8 11 12l1.5 1.5.5 6" />
      <path d="M12.5 13.5 15 15" />
      <path d="M11 12l-2 .8-.5 3.2" />
      <path d="M13 19.5 15 21" />
    </>
  ),
  cycle: (
    <>
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5 10 8h4" />
      <path d="M10 8l4.5 8.5" />
      <path d="M8.5 8h3" />
      <circle cx="13" cy="4.5" r="1.2" />
    </>
  ),
  swim: (
    <>
      <circle cx="8" cy="7" r="1.6" />
      <path d="M9.5 9 14 12l3-1.5" />
      <path d="M3 16.5c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
      <path d="M3 20c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </>
  ),
  lift: (
    <>
      <path d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6" />
      <path d="M7 12h10" />
    </>
  ),
  random: (
    <>
      <path d="M12 4v16M4 12h16" />
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </>
  ),
  rest: (
    <>
      <path d="M20 14.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 10.5Z" />
    </>
  ),
};

export default function SportIcon({ bucket, size = 24, className }: SportIconProps) {
  const glyph = PATHS[bucket] ?? PATHS.random;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {glyph}
    </svg>
  );
}
