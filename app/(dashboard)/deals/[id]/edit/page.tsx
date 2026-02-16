"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mic, MicOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
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
import { useVoiceCommandRecognition } from "@/src/hooks/useVoiceCommandRecognition";
import { parseVoiceCommand } from "@/src/lib/voice/commandParser";

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

const updateDealFormSchema = z.object({
  brand_id: z.string().uuid({ message: "Please select a brand" }),
  title: z.string().trim().min(1).max(200),
  total_value: z.number().positive().finite(),
  currency: z.enum(["USD", "INR"]),
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID", "CANCELLED"]),
  revision_limit: z.number().int().min(1).max(20).default(2),
  exclusivity_rules: z.array(exclusivityRuleFormSchema).default([]),
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
        deal.status === "PAID" ||
        deal.status === "CANCELLED"
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

    updateDealMutation.mutate({
      id: dealId,
      ...values,
    });
  };
  const onInvalidSubmit = () => {
    const firstError =
      getFirstFieldError(form.formState.errors) ??
      "Please fix the highlighted form fields and try again.";
    toast.error(firstError, { duration: 3000 });
  };

  const isLoadingDeal = dealQuery.isLoading;
  const brandItems = brands?.items ?? [];
  const hasBrands = brandItems.length > 0;
  const isSubmitting = updateDealMutation.isPending;
  const brandNames = brandItems.map((brand) => brand.name);

  const applyVoiceCommand = useCallback(
    (transcript: string) => {
      const command = parseVoiceCommand(transcript, brandNames);

      if (command.intent === "UPDATE_DEAL_STATUS") {
        form.setValue("status", command.status, { shouldDirty: true });
        toast.success(`Deal status set to ${command.status}.`, {
          duration: 2200,
        });
        return;
      }

      if (command.intent === "CREATE_DEAL") {
        if (command.brandName) {
          const matchedBrand = brandItems.find(
            (brand) =>
              brand.name.toLowerCase() === command.brandName?.toLowerCase(),
          );
          if (matchedBrand) {
            form.setValue("brand_id", matchedBrand.id, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }

        if (command.title) {
          form.setValue("title", command.title, { shouldDirty: true });
        }
        if (command.amount && command.amount > 0) {
          form.setValue("total_value", command.amount, { shouldDirty: true });
        }
        if (command.currency) {
          form.setValue("currency", command.currency, { shouldDirty: true });
        }
        if (command.status) {
          form.setValue("status", command.status, { shouldDirty: true });
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

      toast.error("Command not recognized. Try: set status to agreed.", {
        duration: 2800,
      });
    },
    [brandItems, brandNames, form],
  );

  const voice = useVoiceCommandRecognition({
    language: "en-US",
    onTranscript: (transcript) => {
      applyVoiceCommand(transcript);
    },
  });

  if (!dealId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <p className="text-sm text-red-600">Invalid deal id.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
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
          <div className="mt-4 rounded-lg border dash-border p-3 dash-border">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={
                  voice.isListening ? voice.stopListening : voice.startListening
                }
                disabled={!voice.isSupported}
                className="h-9"
              >
                {voice.isListening ? (
                  <>
                    <MicOff className="mr-2 h-4 w-4" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Voice Command
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Try: "Set status to agreed."
              </p>
            </div>
            {voice.error ? (
              <p className="mt-2 text-xs text-red-600">{voice.error}</p>
            ) : null}
          </div>
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addExclusivityRule}
                    >
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

              <div className="flex flex-col-reverse gap-3 border-t dash-border pt-5 sm:flex-row sm:items-center sm:justify-end dash-border">
                <Link
                  href={`/deals/${dealId}`}
                  className={buttonVariants({ variant: "outline" })}
                >
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
