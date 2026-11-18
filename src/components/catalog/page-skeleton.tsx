/** Suspense fallback for catalog pages. Static, calm, and announced as loading. */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="animate-pulse motion-reduce:animate-none">
      <div className="h-4 w-48 rounded bg-muted" />
      <div className="mt-6 h-8 w-2/3 max-w-md rounded bg-muted" />
      <div className="mt-3 h-4 w-full max-w-2xl rounded bg-muted" />
      <div className="mt-10 h-64 w-full rounded-xl bg-muted" />
    </div>
  );
}
