function DetailSkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card p-6 shadow-sm dash-border dash-bg-panel sm:p-8">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border dash-border p-4 dash-border">
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-4 space-y-3">
              <DetailSkeletonRow />
              <DetailSkeletonRow />
              <DetailSkeletonRow />
            </div>
          </section>

          <section className="rounded-xl border dash-border p-4 dash-border">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-4 space-y-3">
              <DetailSkeletonRow />
              <DetailSkeletonRow />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
