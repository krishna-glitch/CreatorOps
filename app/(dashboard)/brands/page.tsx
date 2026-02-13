"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";

export default function BrandsPage() {
  const [brandName, setBrandName] = useState("");
  const trpcUtils = trpc.useUtils();
  const { data: brands, isLoading, error } = trpc.brands.list.useQuery();
  const createBrandMutation = trpc.brands.create.useMutation({
    onSuccess: async () => {
      setBrandName("");
      await trpcUtils.brands.list.invalidate();
      toast.success("Brand created", { duration: 3000 });
    },
    onError: (mutationError) => {
      toast.error(mutationError.message || "Could not create brand", {
        duration: 3000,
      });
    },
  });

  const handleCreateBrand = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createBrandMutation.mutate({ name: brandName });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Brands
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your saved brands for creating and tracking deals.
            </p>
          </div>
          <Link
            href="/deals/new"
            className={buttonVariants({ variant: "outline" })}
          >
            Create Deal
          </Link>
        </div>

        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row"
          onSubmit={handleCreateBrand}
        >
          <Input
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            placeholder="Add a new brand name"
            className="sm:max-w-sm"
          />
          <button
            type="submit"
            disabled={
              createBrandMutation.isPending || brandName.trim().length === 0
            }
            className={buttonVariants({ variant: "default" })}
          >
            {createBrandMutation.isPending ? "Creating..." : "Create Brand"}
          </button>
        </form>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading brands...</p>
          ) : error ? (
            <p className="text-sm text-red-600">
              Could not load brands. Please refresh.
            </p>
          ) : brands && brands.length > 0 ? (
            <ul className="space-y-2">
              {brands.map((brand) => (
                <li
                  key={brand.id}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
                >
                  {brand.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No brands found yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
