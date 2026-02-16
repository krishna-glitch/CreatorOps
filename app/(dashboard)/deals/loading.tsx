function LoadingDealCard() {
  return (
    <div className="animate-pulse rounded-xl border dash-border p-4 dash-border">
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-3 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-4 h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-3 h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card p-6 shadow-sm dash-border dash-bg-panel sm:p-8">
        <div className="h-8 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-6 space-y-3">
          <LoadingDealCard />
          <LoadingDealCard />
          <LoadingDealCard />
        </div>
      </div>
    </div>
  );
}
