export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Welcome to your creator workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder cards */}
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-950 dark:border-gray-800">
          <h3 className="font-semibold">Total Deals</h3>
          <p className="mt-2 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-950 dark:border-gray-800">
          <h3 className="font-semibold">Active Campaigns</h3>
          <p className="mt-2 text-2xl font-bold">0</p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-gray-950 dark:border-gray-800">
          <h3 className="font-semibold">Pending Payments</h3>
          <p className="mt-2 text-2xl font-bold">$0.00</p>
        </div>
      </div>
    </div>
  );
}
