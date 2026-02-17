"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

const VoiceCommandButton = dynamic(
  () =>
    import("@/src/components/voice/VoiceCommandButton").then(
      (mod) => mod.VoiceCommandButton,
    ),
  { ssr: false },
);

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
    (value) =>
      new Date(value.end_date).getTime() > new Date(value.start_date).getTime(),
    {
      message: "End date must be after start date",
      path: ["end_date"],
    },
  );

const updateDealFormSchema = z
  .object({
    brand_id: z.string().uuid({ message: "Please select a brand" }),
    title: z.string().trim().min(1).max(200),
    total_value: z.number().positive().finite(),
    currency: z.enum(["USD", "INR"]),
    status: z.enum([
      "INBOUND",
      "NEGOTIATING",
      "AGREED",
      "PAID",
      "CANCELLED",
      "REJECTED",
    ]),
    compensation_model: z.enum(["FIXED", "AFFILIATE", "HYBRID"]),
    cash_percent: z.number().int().min(0).max(100),
    affiliate_percent: z.number().int().min(0).max(100),
    guaranteed_cash_value: z.number().nonnegative().finite().optional(),
    expected_affiliate_value: z.number().nonnegative().finite().optional(),
    revision_limit: z.number().int().min(1).max(20).default(2),
    exclusivity_rules: z.array(exclusivityRuleFormSchema).default([]),
  })
  .refine((value) => value.cash_percent + value.affiliate_percent === 100, {
    message: "Cash and affiliate percentages must add up to 100",
    path: ["cash_percent"],
  });

type UpdateDealFormValues = z.input<typeof updateDealFormSchema>;

function getUpdateDealErrorMessage(error: unknown): string {
  const trpcLikeError =
    typeof error === "object" && error !== null ? error : null;
  const trpcMessage =
    trpcLikeError &&
    "message" in trpcLikeError &&
    typeof trpcLikeError.message === "string"
      ? trpcLikeError.message
      : null;
  const zodError =
    trpcLikeError &&
    "data" in trpcLikeError &&
    typeof trpcLikeError.data === "object" &&
    trpcLikeError.data !== null &&
    "zodError" in trpcLikeError.data &&
    typeof trpcLikeError.data.zodError === "object" &&
    trpcLikeError.data.zodError !== null
      ? trpcLikeError.data.zodError
      : null;

  if (
    zodError &&
    "fieldErrors" in zodError &&
    typeof zodError.fieldErrors === "object" &&
    zodError.fieldErrors !== null
  ) {
    const firstFieldError = Object.values(
      zodError.fieldErrors as Record<string, unknown>,
    ).find((value) => Array.isArray(value) && typeof value[0] === "string") as
      | string[]
      | undefined;

    if (firstFieldError?.[0]) {
      return firstFieldError[0];
    }
  }

  if (trpcMessage && trpcMessage.trim().length > 0) {
    return trpcMessage;
  }

  return "Could not update deal. Please review your inputs and try again.";
}

function getFirstFieldError(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = getFirstFieldError(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (typeof value === "object" && value !== null) {
    for (const nestedValue of Object.values(value)) {
      const nested = getFirstFieldError(nestedValue);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

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
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal updated.", { duration: 3000 });
      router.push(`/deals/${dealId}`);
    },
    onError: (error) => {
      toast.error(getUpdateDealErrorMessage(error), { duration: 3000 });
    },
  });
  const deleteDealMutation = trpc.deals.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal deleted.", { duration: 3000 });
      router.push("/deals");
    },
    onError: (error) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Could not delete deal right now.";
      toast.error(message, { duration: 3000 });
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
      compensation_model: "FIXED",
      cash_percent: 100,
      affiliate_percent: 0,
      guaranteed_cash_value: undefined,
      expected_affiliate_value: undefined,
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
      brand_id: deal.brandId ?? deal.brand?.id ?? "",
      title: deal.title,
      total_value: Number(deal.totalValue),
      currency: deal.currency === "INR" ? "INR" : "USD",
      status:
        deal.status === "NEGOTIATING" ||
        deal.status === "AGREED" ||
        deal.status === "PAID" ||
        deal.status === "CANCELLED" ||
        deal.status === "REJECTED"
          ? deal.status
          : "INBOUND",
      compensation_model:
        deal.compensationModel === "AFFILIATE" ||
        deal.compensationModel === "HYBRID"
          ? deal.compensationModel
          : "FIXED",
      cash_percent:
        typeof deal.cashPercent === "number" ? deal.cashPercent : 100,
      affiliate_percent:
        typeof deal.affiliatePercent === "number" ? deal.affiliatePercent : 0,
      guaranteed_cash_value: deal.guaranteedCashValue
        ? Number(deal.guaranteedCashValue)
        : undefined,
      expected_affiliate_value: deal.expectedAffiliateValue
        ? Number(deal.expectedAffiliateValue)
        : undefined,
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
    setShowExclusivityRules((deal.exclusivityRules ?? []).length > 0);
  }, [dealQuery.data, form]);

  const addExclusivityRule = () => {
    setShowExclusivityRules(true);
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

  const togglePlatform = (
    ruleIndex: number,
    platform: (typeof platformOptions)[number],
  ) => {
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

    const fallbackBrandId =
      dealQuery.data?.brandId ?? dealQuery.data?.brand?.id;
    const brandId = values.brand_id || fallbackBrandId;
    if (!brandId) {
      toast.error("Please select a brand.", { duration: 3000 });
      return;
    }

    updateDealMutation.mutate({
      id: dealId,
      ...values,
      brand_id: brandId,
    });
  };
  const onDeleteDeal = () => {
    if (!dealId || deleteDealMutation.isPending) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this deal permanently? This also deletes related payments and exclusivity rules.",
    );
    if (!confirmed) {
      return;
    }

    deleteDealMutation.mutate({ id: dealId });
  };
  const onInvalidSubmit = () => {
    const firstError =
      getFirstFieldError(form.formState.errors) ??
      "Please fix the highlighted form fields and try again.";
    toast.error(firstError, { duration: 3000 });
  };

  const isLoadingDeal = dealQuery.isLoading;
  const brandItems = (() => {
    const items = brands?.items ?? [];
    const currentDeal = dealQuery.data;
    if (!currentDeal?.brand?.id) {
      return items;
    }
    const alreadyPresent = items.some(
      (brand) => brand.id === currentDeal.brand.id,
    );
    if (alreadyPresent) {
      return items;
    }
    return [
      ...items,
      {
        id: currentDeal.brand.id,
        name: currentDeal.brand.name ?? "Current Brand",
      },
    ];
  })();
  const hasBrands = brandItems.length > 0;
  const isSubmitting = updateDealMutation.isPending;
  const compensationModel = form.watch("compensation_model");
  const brandNames = brandItems.map((brand) => brand.name);
  const [showExclusivityRules, setShowExclusivityRules] = useState(false);

  const executeVoiceCommand = useCallback(
    async (command: ParsedCommand) => {
      if (command.intent === "MARK_PAID") {
        form.setValue("status", "PAID", { shouldDirty: true });
        toast.success("Deal status set to PAID.", {
          duration: 2200,
        });
        return;
      }

      if (command.intent === "CREATE_DEAL") {
        if (command.entities.brand) {
          const matchedBrand =
            brandItems.find(
              (brand) =>
                brand.name.toLowerCase() ===
                command.entities.brand?.toLowerCase(),
            ) ?? null;

          if (matchedBrand) {
            form.setValue("brand_id", matchedBrand.id, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }

        if (command.entities.amount && command.entities.amount > 0) {
          form.setValue("total_value", command.entities.amount, {
            shouldDirty: true,
          });
        }
        if (command.entities.currency) {
          form.setValue("currency", command.entities.currency, {
            shouldDirty: true,
          });
        }

        toast.success("Voice command applied to edit form.", {
          duration: 2200,
        });
        return;
      }

      if (command.intent === "ADD_PAYMENT") {
        toast.error(
          "This command is for payments. Open Add Payment to use it.",
          {
            duration: 2800,
          },
        );
        return;
      }

      toast.error("Command not recognized. Try: set status to paid.", {
        duration: 2800,
      });
    },
    [brandItems, form],
  );

  if (!dealId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <p className="text-sm text-red-600">Invalid deal id.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <VoiceCommandButton
        brandVocabulary={brandNames}
        disabled={isSubmitting}
        onExecuteCommand={executeVoiceCommand}
      />
      <div className="rounded-2xl border dash-border dash-bg-card shadow-sm dash-border dash-bg-panel">
        <div className="border-b dash-border px-5 py-5 sm:px-8 dash-border">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Deal Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Edit Deal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update deal details and exclusivity rules.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: Tap the floating mic button to use voice commands.
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
              onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}
              className="space-y-7 px-5 py-6 sm:px-8 sm:py-8"
            >
              <div className="grid grid-cols-1 gap-5">
                <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                  <p className="text-sm font-medium">Basics</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="brand_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Brand
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
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
                                brandItems.map((brand) => (
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
                          <FormLabel className="text-sm font-medium">
                            Title
                          </FormLabel>
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

                <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                  <p className="text-sm font-medium">Commercial Terms</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="total_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Total Value
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                field.onChange(
                                  nextValue === ""
                                    ? undefined
                                    : Number(nextValue),
                                );
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
                          <FormLabel className="text-sm font-medium">
                            Currency
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
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

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
                    <FormField
                      control={form.control}
                      name="compensation_model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Compensation Model
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(nextValue) => {
                              field.onChange(nextValue);
                              if (nextValue === "FIXED") {
                                form.setValue("cash_percent", 100, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                form.setValue("affiliate_percent", 0, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              } else if (nextValue === "AFFILIATE") {
                                form.setValue("cash_percent", 0, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                form.setValue("affiliate_percent", 100, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FIXED">FIXED</SelectItem>
                              <SelectItem value="AFFILIATE">
                                AFFILIATE
                              </SelectItem>
                              <SelectItem value="HYBRID">HYBRID</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cash_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Cash %
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={field.value ?? 0}
                              disabled={compensationModel !== "HYBRID"}
                              onChange={(event) =>
                                field.onChange(Number(event.target.value))
                              }
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="affiliate_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            Affiliate %
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={field.value ?? 0}
                              disabled={compensationModel !== "HYBRID"}
                              onChange={(event) =>
                                field.onChange(Number(event.target.value))
                              }
                              onBlur={field.onBlur}
                            />
                          </FormControl>
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
                          <FormLabel className="text-sm font-medium">
                            Status
                          </FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="focus:ring-emerald-500/30 focus:ring-offset-0">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INBOUND">INBOUND</SelectItem>
                              <SelectItem value="NEGOTIATING">
                                NEGOTIATING
                              </SelectItem>
                              <SelectItem value="AGREED">AGREED</SelectItem>
                              <SelectItem value="PAID">PAID</SelectItem>
                              <SelectItem value="CANCELLED">
                                CANCELLED
                              </SelectItem>
                              <SelectItem value="REJECTED">REJECTED</SelectItem>
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
                          <FormLabel className="text-sm font-medium">
                            Revision Limit
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              max="20"
                              value={field.value ?? 2}
                              onChange={(event) =>
                                field.onChange(Number(event.target.value))
                              }
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Exclusivity Rules</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Existing rules are listed below. You can add or delete
                        rules.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setShowExclusivityRules((current) => !current)
                        }
                      >
                        {showExclusivityRules ? "Hide Rules" : "Show Rules"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addExclusivityRule}
                      >
                        Add Rule
                      </Button>
                    </div>
                  </div>

                  {!showExclusivityRules ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {exclusivityRulesArray.fields.length === 0
                        ? "No exclusivity rules for this deal."
                        : `${exclusivityRulesArray.fields.length} rule(s) configured. Expand to edit.`}
                    </p>
                  ) : exclusivityRulesArray.fields.length === 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No exclusivity rules for this deal.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {exclusivityRulesArray.fields.map((field, index) => {
                        const selectedPlatforms =
                          form.watch(`exclusivity_rules.${index}.platforms`) ??
                          [];

                        return (
                          <div
                            key={field.id}
                            className="rounded-lg border dash-border p-4 dash-border"
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">
                                Rule {index + 1}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  exclusivityRulesArray.remove(index)
                                }
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
                                    <FormLabel className="text-sm font-medium">
                                      Category
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Tech/Smartphones"
                                        {...categoryField}
                                      />
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
                                    <FormLabel className="text-sm font-medium">
                                      Scope
                                    </FormLabel>
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
                                        <SelectItem value="EXACT_CATEGORY">
                                          EXACT
                                        </SelectItem>
                                        <SelectItem value="PARENT_CATEGORY">
                                          PARENT
                                        </SelectItem>
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
                                    <FormLabel className="text-sm font-medium">
                                      Start Date
                                    </FormLabel>
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
                                    <FormLabel className="text-sm font-medium">
                                      End Date
                                    </FormLabel>
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
                                  const active =
                                    selectedPlatforms.includes(platform);
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
                                      onClick={() =>
                                        togglePlatform(index, platform)
                                      }
                                    >
                                      {platform}
                                    </Button>
                                  );
                                })}
                              </div>
                              <p className="mt-2 text-xs text-red-600">
                                {
                                  form.formState.errors.exclusivity_rules?.[
                                    index
                                  ]?.platforms?.message
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

              <div className="flex flex-col-reverse gap-3 border-t dash-border pt-5 sm:flex-row sm:items-center sm:justify-between dash-border">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDeleteDeal}
                  disabled={isSubmitting || deleteDealMutation.isPending}
                >
                  {deleteDealMutation.isPending ? "Deleting..." : "Delete Deal"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/deals/${dealId}`)}
                  disabled={isSubmitting || deleteDealMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || !hasBrands || deleteDealMutation.isPending
                  }
                >
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
