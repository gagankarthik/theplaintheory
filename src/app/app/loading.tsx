/** Skeleton matching the page-header + content rhythm, so the layout doesn't jump when data arrives. */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div aria-hidden className="animate-pulse motion-reduce:animate-none">
        <div className="mb-3 h-3 w-40 rounded bg-line" />
        <div className="mb-3 h-8 w-64 rounded bg-line" />
        <div className="mb-10 h-4 w-full max-w-lg rounded bg-line" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-surface p-5">
              <div className="h-3 w-24 rounded bg-line" />
              <div className="mt-3 h-7 w-16 rounded bg-line" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-72 rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}
