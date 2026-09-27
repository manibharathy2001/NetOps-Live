export function SkeletonBar({ className = '' }) {
  return <span className={`block animate-pulse rounded bg-line ${className}`} aria-hidden="true" />;
}

// Placeholder rows that keep the table's shape while the first fetch runs.
export function SkeletonRows({ rows = 5, className = '' }) {
  return (
    <div className={`space-y-3 px-5 py-4 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="hidden h-4 w-28 md:block" />
          <SkeletonBar className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
