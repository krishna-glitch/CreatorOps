"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const exclusivityRuleFormSchema = z
  .object({
    category_path: z.string().trim().min(1).max(200),
    scope: z.enum(["EXACT_CATEGORY", "PARENT_CATEGORY"]),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    platforms: z.array(z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"])).min(1),
    regions: z.array(z.enum(["US", "IN", "GLOBAL"])).default(["GLOBAL"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => new Date(value.end_date).getTime() > new Date(value.start_date).getTime(),
    {
      message: "End date must be after start date",
      path: ["end_date"],
    },
  );

const updateDealFormSchema = z.object({
  brand_id: z.string().uuid({ message: "Please select a brand" }),
  title: z.string().trim().min(1).max(200),
  total_value: z.number().positive().finite(),
  currency: z.enum(["USD", "INR"]),
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID"]),
  revision_limit: z.number().int().min(1).max(20).default(2),
  exclusivity_rules: z.array(exclusivityRuleFormSchema).default([]),
});

type UpdateDealFormValues = z.input<typeof updateDealFormSchema>;

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default function EditDealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const dealId = params?.id;
  const platformOptions = ["INSTAGRAM", "YOUTUBE", "TIKTOK"] as const;

  const { data: brands, isLoading: isLoadingBrands } =
    trpc.brands.list.useQuery({ limit: 100 });

  const dealQuery = trpc.deals.getById.useQuery(
    { id: dealId ?? "" },
    {
      enabled: Boolean(dealId),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const updateDealMutation = trpc.deals.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.deals.getById.invalidate({ id: dealId }),
        trpcUtils.deals.list.invalidate(),
      ]);
      toast.success("Deal updated.", { duration: 3000 });
      router.push(`/deals/${dealId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Could not update deal.", { duration: 3000 });
    },
  });

  const form = useForm<UpdateDealFormValues>({
    resolver: zodResolver(updateDealFormSchema),
    defaultValues: {
      brand_id: "",
      title: "",
      total_value: undefined,
      currency: "USD",
      status: "INBOUND",
      revision_limit: 2,
      exclusivity_rules: [],
    },
  });

  const exclusivityRulesArray = useFieldArray({
    control: form.control,
    name: "exclusivity_rules",
  });

  useEffect(() => {
    const deal = dealQuery.data;
    if (!deal) {
      return;
    }

    form.reset({
      brand_id: deal.brandId,
      title: deal.title,
      total_value: Number(deal.totalValue),
      currency: deal.currency === "INR" ? "INR" : "USD",
      status:
        deal.status === "NEGOTIATING" ||
        deal.status === "AGREED" ||
        deal.status === "PAID"
          ? deal.status
          : "INBOUND",
      revision_limit: deal.revisionLimit,
      exclusivity_rules: (deal.exclusivityRules ?? []).map((rule) => ({
        category_path: rule.categoryPath,
        scope: rule.scope,
        start_date: toDateInputValue(rule.startDate),
        end_date: toDateInputValue(rule.endDate),
        platforms: rule.platforms,
        regions: rule.regions,
        notes: rule.notes ?? "",
      })),
    });
  }, [dealQuery.data, form]);

  const addExclusivityRule = () => {
    exclusivityRulesArray.append({
      category_path: "",
      scope: "EXACT_CATEGORY",
      start_date: "",
      end_date: "",
      platforms: ["INSTAGRAM"],
      regions: ["GLOBAL"],
      notes: "",
    });
  };

  const togglePlatform = (ruleIndex: number, platform: (typeof platformOptions)[number]) => {
    const fieldName = `exclusivity_rules.${ruleIndex}.platforms` as const;
    const current = form.getValues(fieldName) ?? [];
    const hasPlatform = current.includes(platform);
    const nextPlatforms = hasPlatform
      ? current.filter((item) => item !== platform)
      : [...current, platform];

    form.setValue(fieldName, nextPlatforms, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const onSubmit = (values: UpdateDealFormValues) => {
    if (!dealId) {
      return;
    }

    updateDealMutation.mutate({
      id: dealId,
      ...values,
    });
  };

  const isLoadingDeal = dealQuery.isLoading;
  const hasBrands = (brands?.items ?? []).length > 0;
  const isSubmitting = updateDealMutation.isPending;

  if (!dealId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <p className="text-sm text-red-600">Invalid deal id.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-8 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Deal Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Edit Deal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update deal details and exclusivity rules.
          </p>
        </div>

        {isLoadingDeal ? (
          <div className="px-5 py-6 text-sm text-muted-foreground sm:px-8 sm:py-8">
            Loading deal...
          </div>
        ) : dealQuery.error ? (
          <div className="px-5 py-6 text-sm text-red-600 sm:px-8 sm:py-8">
            Could not load deal details.
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-7 px-5 py-6 sm:px-8 sm:py-8"
            >
              <div className="grid grid-cols-1 gap-5">
                <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
                  <p className="text-sm font-medium">Basics</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="brand_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Brand</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingBrands ? (
                                <SelectItem value="loading" disabled>
                                  Loading brands...
                                </SelectItem>
                              ) : (
                                (brands?.items ?? []).map((brand) => (
                                  <SelectItem key={brand.id} value={brand.id}>
                                    {brand.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Summer campaign"
                              className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
                  <p className="text-sm font-medium">Commercial Terms</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="total_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Total Value</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                field.onChange(nextValue === "" ? undefined : Number(nextValue));
                              }}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Currency</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="INR">INR</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INBOUND">INBOUND</SelectItem>
                              <SelectItem value="NEGOTIATING">NEGOTIATING</SelectItem>
                              <SelectItem value="AGREED">AGREED</SelectItem>
                              <SelectItem value="PAID">PAID</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="revision_limit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Revision Limit</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              max="20"
                              value={field.value ?? 2}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Exclusivity Rules</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Existing rules are listed below. You can add or delete rules.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addExclusivityRule}>
                      Add Rule
                    </Button>
                  </div>

                  {exclusivityRulesArray.fields.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No exclusivity rules for this deal.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {exclusivityRulesArray.fields.map((field, index) => {
                        const selectedPlatforms =
                          form.watch(`exclusivity_rules.${index}.platforms`) ?? [];

                        return (
                          <div
                            key={field.id}
                            className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">Rule {index + 1}</p>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => exclusivityRulesArray.remove(index)}
                              >
                                Delete Rule
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`exclusivity_rules.${index}.category_path`}
                                render={({ field: categoryField }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Category</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Tech/Smartphones" {...categoryField} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`exclusivity_rules.${index}.scope`}
                                render={({ field: scopeField }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Scope</FormLabel>
                                    <Select
                                      value={scopeField.value}
                                      onValueChange={scopeField.onChange}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                          <SelectValue placeholder="Select scope" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="EXACT_CATEGORY">EXACT</SelectItem>
                                        <SelectItem value="PARENT_CATEGORY">PARENT</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <FormField
                                control={form.control}
                                name={`exclusivity_rules.${index}.start_date`}
                                render={({ field: startDateField }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">Start Date</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...startDateField} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`exclusivity_rules.${index}.end_date`}
                                render={({ field: endDateField }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm font-medium">End Date</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...endDateField} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <div className="mt-4">
                              <p className="text-sm font-medium">Platforms</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {platformOptions.map((platform) => {
                                  const active = selectedPlatforms.includes(platform);
                                  return (
                                    <Button
                                      key={platform}
                                      type="button"
                                      variant="outline"
                                      className={
                                        active
                                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                          : ""
                                      }
                                      onClick={() => togglePlatform(index, platform)}
                                    >
                                      {platform}
                                    </Button>
                                  );
                                })}
                              </div>
                              <p className="mt-2 text-xs text-red-600">
                                {
                                  form.formState.errors.exclusivity_rules?.[index]?.platforms
                                    ?.message
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-end dark:border-gray-800">
                <Link href={`/deals/${dealId}`} className={buttonVariants({ variant: "outline" })}>
                  Cancel
                </Link>
                <Button type="submit" disabled={isSubmitting || !hasBrands}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
