export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading Shift Report"
      className="grid gap-5"
    >
      <div className="h-20 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-48 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-96 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      <p className="sr-only" role="status">
        Loading your authorized Shift Report.
      </p>
    </div>
  );
}
