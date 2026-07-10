export default function RunnerOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <img
        src="/runner.png"
        alt=""
        className="h-[60px] w-auto -rotate-[18deg] opacity-50"
      />
    </div>
  );
}
