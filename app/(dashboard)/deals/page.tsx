import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function DealsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Deals
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deal list view will be expanded in Phase 4. You can continue creating
          deals now.
        </p>
        <div className="mt-6">
          <Link href="/deals/new" className={buttonVariants()}>
            Create New Deal
          </Link>
        </div>
      </div>
    </div>
  );
}
