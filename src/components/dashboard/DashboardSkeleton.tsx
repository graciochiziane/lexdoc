// ═══════════════════════════════════════════════════════════════
// LEXDOC — Full-Page Dashboard Loading Skeleton
// Beautiful shimmer skeleton matching the dashboard layout
// ═══════════════════════════════════════════════════════════════

'use client';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500">
      {/* Welcome Card skeleton */}
      <div className="shimmer-loading rounded-xl h-32 w-full" />

      {/* Quick Stats Row skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer-loading rounded-full h-9 w-36" />
        ))}
      </div>

      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="shimmer-loading h-7 w-48 rounded" />
        <div className="shimmer-loading h-4 w-64 rounded" />
      </div>

      {/* Stat Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-l-4 border-border overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between pb-2">
                <div className="shimmer-loading h-4 w-24 rounded" />
                <div className="shimmer-loading w-8 h-8 rounded-lg" />
              </div>
              <div className="shimmer-loading h-8 w-16 rounded mb-2" />
              <div className="shimmer-loading h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Charts — 2 cols */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border-l-4 border-border overflow-hidden">
              <div className="p-5">
                <div className="shimmer-loading h-4 w-32 rounded mb-4" />
                <div className="shimmer-loading h-[160px] w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        {/* Activity Feed skeleton */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="p-5">
              <div className="shimmer-loading h-5 w-32 rounded mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shimmer-loading w-8 h-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="shimmer-loading h-3.5 w-36 rounded" />
                      <div className="shimmer-loading h-3 w-28 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent processes skeleton */}
      <div className="rounded-xl border border-border overflow-hidden p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="shimmer-loading h-5 w-36 rounded" />
          <div className="shimmer-loading h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="shimmer-loading h-4 w-28 rounded" />
              <div className="shimmer-loading h-4 w-40 rounded" />
              <div className="shimmer-loading h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
