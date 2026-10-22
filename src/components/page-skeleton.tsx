/** Lightweight placeholder shown while a page loads (slow mobile data). */
export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="h-7 w-48 rounded-lg bg-surface-2" />
      <div className="mt-2 h-4 w-64 rounded bg-surface-2" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
