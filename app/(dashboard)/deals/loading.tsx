function LoadingDealCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 p-4 dark:border-gray-800">
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
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
