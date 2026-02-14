"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";

const PAGE_SIZE = 50;

export default function BrandsPage() {
  const [search, setSearch] = useState("");

  const queryInput = useMemo(
    () => ({
      search: search.trim().length > 0 ? search : undefined,
      limit: PAGE_SIZE,
    }),
    [search],
  );

  const { data, isLoading, error } = trpc.brands.list.useQuery(queryInput, {
    refetchOnWindowFocus: false,
  });

  const brands = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Brands
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your brands for deal creation and tracking.
            </p>
          </div>
          <Link href="/brands/new" className={buttonVariants()}>
            New Brand
          </Link>
        </div>

        <div className="mt-5">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search brands by name"
            className="sm:max-w-sm"
          />
        </div>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading brands...</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              Could not load brands. Please refresh.
            </p>
          ) : brands.length > 0 ? (
            <ul className="space-y-2">
              {brands.map((brand) => (
                <li key={brand.id}>
                  <Link
                    href={`/brands/${brand.id}`}
                    className="block rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors hover:border-gray-300 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900"
                  >
                    {brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No brands found for this search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
