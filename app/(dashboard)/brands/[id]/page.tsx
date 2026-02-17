"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import {
  formatDealCurrency,
  formatDealDate,
  StatusBadge,
} from "@/src/components/deals/StatusBadge";

export default function BrandDetailPage() {
  const params = useParams<{ id: string }>();
  const brandId = params?.id;
  const trpcUtils = trpc.useUtils();

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  const brandQuery = trpc.brands.getById.useQuery(
    { id: brandId ?? "" },
    {
      enabled: Boolean(brandId),
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const dealsQuery = trpc.deals.list.useQuery(
    { limit: 100 },
    {
      refetchOnWindowFocus: false,
    },
  );

  const associatedDeals = useMemo(() => {
    const items = dealsQuery.data?.items ?? [];
    return items.filter((deal) => deal.brandId === brandId);
  }, [dealsQuery.data?.items, brandId]);

  const updateBrandMutation = trpc.brands.update.useMutation({
    onSuccess: async (updatedBrand) => {
      setIsEditing(false);
      setDraftName(updatedBrand.name);
      await Promise.all([
        trpcUtils.brands.getById.invalidate({ id: updatedBrand.id }),
        trpcUtils.brands.list.invalidate(),
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Brand updated.", { duration: 3000 });
    },
    onError: (error) => {
      toast.error(error.message || "Could not update brand", {
        duration: 3000,
      });
    },
  });

  const deleteBrandMutation = trpc.brands.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.brands.list.invalidate(),
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Brand deleted.", { duration: 3000 });
      window.location.href = "/brands";
    },
    onError: (error) => {
      toast.error(error.message || "Could not delete brand", {
        duration: 3000,
      });
    },
  });

  const handleStartEdit = () => {
    if (!brandQuery.data) {
      return;
    }

    setDraftName(brandQuery.data.name);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraftName(brandQuery.data?.name ?? "");
  };

  const handleSave = () => {
    if (!brandId || draftName.trim().length === 0) {
      return;
    }

    updateBrandMutation.mutate({
      id: brandId,
      name: draftName,
    });
  };

  const handleDelete = () => {
    if (!brandId || !brand) {
      return;
    }

    const confirmed = window.confirm(
      `Delete brand "${brand.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    deleteBrandMutation.mutate({ id: brandId });
  };

  if (!brandId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <p className="text-sm text-red-600">Invalid brand id.</p>
      </div>
    );
  }

  const isLoadingBrand = brandQuery.isLoading;
  const brandError = brandQuery.error;
  const brand = brandQuery.data;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card p-6 shadow-sm dash-border dash-bg-panel sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Brand Detail
            </p>

            {isLoadingBrand ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Loading brand...
              </p>
            ) : brandError ? (
              <p className="mt-2 text-sm text-red-600">
                Could not load brand details.
              </p>
            ) : isEditing ? (
              <div className="mt-2">
                <Input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="h-11 text-lg font-semibold"
                  placeholder="Brand name"
                />
              </div>
            ) : (
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {brand?.name}
              </h1>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/brands"
              className={buttonVariants({ variant: "outline" })}
            >
              Back to Brands
            </Link>

            {!isLoadingBrand && !brandError && brand ? (
              isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={updateBrandMutation.isPending}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      updateBrandMutation.isPending ||
                      draftName.trim().length === 0
                    }
                    className={buttonVariants()}
                  >
                    {updateBrandMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Edit
                </button>
              )
            ) : null}
            {!isLoadingBrand && !brandError && brand ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  deleteBrandMutation.isPending ||
                  updateBrandMutation.isPending ||
                  associatedDeals.length > 0
                }
                className={buttonVariants({ variant: "destructive" })}
                title={
                  associatedDeals.length > 0
                    ? "Delete associated deals before deleting this brand"
                    : "Delete this brand"
                }
              >
                {deleteBrandMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>
        </div>

        {brand ? (
          <section className="mt-6 rounded-xl border dash-border p-4 dash-border">
            <h2 className="text-sm font-medium">Brand Details</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="text-sm font-medium">{brand.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="text-sm font-medium">
                  {formatDealDate(brand.createdAt, { includeTime: true })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-sm text-muted-foreground">Updated</dt>
                <dd className="text-sm font-medium">
                  {formatDealDate(brand.updatedAt, { includeTime: true })}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        <section className="mt-6 rounded-xl border dash-border p-4 dash-border">
          <h2 className="text-sm font-medium">Associated Deals</h2>

          {dealsQuery.isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading deals...
            </p>
          ) : dealsQuery.error ? (
            <p className="mt-3 text-sm text-red-600">
              Could not load associated deals.
            </p>
          ) : associatedDeals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No deals found for this brand.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {associatedDeals.map((deal) => (
                <li key={deal.id}>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="block rounded-lg border dash-border px-3 py-3 transition-colors dash-border dash-bg-card dash-border dark:hover:border-gray-700 dark:hover:bg-gray-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{deal.title}</p>
                      <StatusBadge status={deal.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDealCurrency(deal.totalValue, {
                        currency: deal.currency,
                      })}
                      {" · "}
                      {formatDealDate(deal.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
