"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { VoiceCommandButton } from "@/src/components/voice/VoiceCommandButton";
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

const exclusivityRuleFormSchema = z
  .object({
    category_path: z
      .string()
      .trim()
      .min(1, { message: "Category is required" })
      .max(200, { message: "Category must be at most 200 characters" }),
    scope: z.enum(["EXACT_CATEGORY", "PARENT_CATEGORY"], {
      message: "Please select a scope",
    }),
    start_date: z.string().min(1, { message: "Start date is required" }),
    end_date: z.string().min(1, { message: "End date is required" }),
    platforms: z
      .array(z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"]))
      .min(1, { message: "Select at least one platform" }),
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

const createDealFormSchema = z.object({
  brand_id: z.string().uuid({ message: "Please select a brand" }),
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required" })
    .max(200, { message: "Title must be at most 200 characters" }),
  total_value: z
    .number({ message: "Total value is required" })
    .finite({ message: "Total value must be a valid number" })
    .positive({ message: "Total value must be greater than 0" }),
  currency: z.enum(["USD", "INR"], {
    message: "Please select a currency",
  }),
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID", "CANCELLED"], {
    message: "Please select a status",
  }),
  exclusivity_rules: z.array(exclusivityRuleFormSchema).default([]),
});

type CreateDealFormValues = z.input<typeof createDealFormSchema>;

function getCreateDealErrorMessage(error: unknown): string {
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

  if (trpcMessage?.includes("Brand not found")) {
    return "Selected brand was not found. Please refresh and try again.";
  }

  if (trpcMessage?.includes("UNAUTHORIZED")) {
    return "Your session expired. Please sign in again.";
  }

  if (
    trpcMessage?.includes("Failed query:") ||
    trpcMessage?.includes("Could not create deal:")
  ) {
    return "Could not create deal right now. Please try again in a moment.";
  }

  if (trpcMessage && trpcMessage.trim().length > 0) {
    return trpcMessage;
  }

  return "Could not create the deal. Please check your inputs and try again.";
}

function getCreateBrandErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("UNAUTHORIZED")) {
    return "Your session expired. Please sign in again.";
  }

  return "Could not create brand. Please try again.";
}

export default function NewDealPage() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const platformOptions = ["INSTAGRAM", "YOUTUBE", "TIKTOK"] as const;
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [selectedBrandFallbackName, setSelectedBrandFallbackName] = useState<
    string | null
  >(null);

  const { data: brands, isLoading: isLoadingBrands } =
    trpc.brands.list.useQuery({ limit: 100 });

  const createBrandMutation = trpc.brands.create.useMutation({
    onSuccess: async (createdBrand) => {
      setSelectedBrandFallbackName(createdBrand.name);
      setNewBrandName("");
      setBrandPopoverOpen(false);
      form.setValue("brand_id", createdBrand.id, {
        shouldDirty: true,
        shouldValidate: true,
      });

      await trpcUtils.brands.list.invalidate();
      toast.success("Brand created and selected.", { duration: 3000 });
    },
    onError: (error) => {
      toast.error(getCreateBrandErrorMessage(error), { duration: 3000 });
    },
  });

  const createDealMutation = trpc.deals.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.deals.list.invalidate(),
        trpcUtils.analytics.getDashboardStats.invalidate(),
      ]);
      toast.success("Deal created successfully.", { duration: 3000 });
      router.push("/deals");
    },
    onError: (error) => {
      toast.error(getCreateDealErrorMessage(error), { duration: 3000 });
    },
  });

  const form = useForm<CreateDealFormValues>({
    resolver: zodResolver(createDealFormSchema),
    defaultValues: {
      brand_id: "",
      title: "",
      total_value: undefined,
      currency: "USD",
      status: "INBOUND",
      exclusivity_rules: [],
    },
  });
  const exclusivityRulesArray = useFieldArray({
    control: form.control,
    name: "exclusivity_rules",
  });

  const onSubmit = (values: CreateDealFormValues) => {
    createDealMutation.mutate(values);
  };

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

  const isSubmitting = createDealMutation.isPending;
  const brandItems = brands?.items ?? [];
  const hasBrands = brandItems.length > 0;
  const canCreateBrand =
    newBrandName.trim().length > 0 && !createBrandMutation.isPending;
  const brandNames = brandItems.map((brand) => brand.name);

  const executeVoiceCommand = async (command: ParsedCommand) => {
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
          setSelectedBrandFallbackName(matchedBrand.name);
        } else {
          await createBrandMutation.mutateAsync({
            name: command.entities.brand,
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
      if (command.entities.brand) {
        form.setValue("title", `${command.entities.brand} collab`, {
          shouldDirty: true,
        });
      }

      toast.success("Voice command applied to deal form.", {
        duration: 2200,
      });
      return;
    }

    if (command.intent === "MARK_PAID") {
      form.setValue("status", "PAID", {
        shouldDirty: true,
      });
      toast.success("Deal status set to PAID.", { duration: 2200 });
      return;
    }

    if (command.intent === "OPEN_NEW_DEAL_FORM") {
      toast.info("You are already on the new deal form.", { duration: 2200 });
      return;
    }

    toast.error("This voice command isn't supported on this page.", {
      duration: 2800,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <VoiceCommandButton
        brandVocabulary={brandNames}
        disabled={isSubmitting || createBrandMutation.isPending}
        onExecuteCommand={executeVoiceCommand}
      />
      <div className="rounded-2xl border dash-border dash-bg-card shadow-sm dash-border dash-bg-panel">
        <div className="border-b dash-border px-5 py-5 sm:px-8 dash-border">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Deal Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Create New Deal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add core details to create and track a brand deal.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: Tap the floating mic button to use voice commands.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-7 px-5 py-6 sm:px-8 sm:py-8"
          >
            <div className="grid grid-cols-1 gap-5">
              <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                <p className="text-sm font-medium">Basics</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start with brand and a short deal title.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-5">
                  <FormField
                    control={form.control}
                    name="brand_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">
                          Brand
                        </FormLabel>
                        <Popover
                          open={brandPopoverOpen}
                          onOpenChange={setBrandPopoverOpen}
                        >
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between pl-3 text-left font-normal dash-bg-card focus:ring-emerald-500/30",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value
                                  ? (brandItems.find(
                                      (brand) => brand.id === field.value,
                                    )?.name ?? selectedBrandFallbackName)
                                  : "Select brand"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[300px] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput placeholder="Search brand..." />
                              <CommandList>
                                <CommandEmpty>
                                  No brand found. Create one below.
                                </CommandEmpty>
                                <CommandGroup>
                                  {brandItems.map((brand) => (
                                    <CommandItem
                                      value={brand.name}
                                      key={brand.id}
                                      onSelect={() => {
                                        setSelectedBrandFallbackName(null);
                                        setBrandPopoverOpen(false);
                                        form.setValue("brand_id", brand.id, {
                                          shouldValidate: true,
                                        });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          brand.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {brand.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                            <div className="border-t p-3">
                              <p className="mb-2 text-xs text-muted-foreground">
                                Brand missing? Add it now.
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  value={newBrandName}
                                  onChange={(event) =>
                                    setNewBrandName(event.target.value)
                                  }
                                  placeholder="New brand name"
                                  className="h-9"
                                />
                                <Button
                                  type="button"
                                  onClick={() =>
                                    createBrandMutation.mutate({
                                      name: newBrandName.trim(),
                                    })
                                  }
                                  disabled={!canCreateBrand}
                                  className="h-9"
                                >
                                  {createBrandMutation.isPending
                                    ? "Adding..."
                                    : "Add"}
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        {!hasBrands && !isLoadingBrands && (
                          <p className="text-xs text-muted-foreground">
                            No brands yet. Add one from the dropdown.
                          </p>
                        )}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter value, currency, and current status.
                </p>

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
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                              {form.watch("currency") === "USD" ? "$" : "₹"}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="pl-7 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
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
                          </div>
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
                          <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-xl border dash-border p-4 sm:p-5 dash-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Exclusivity Rules</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add one or more exclusivity constraints for this deal.
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
                    No exclusivity rules added yet.
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
                                      className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
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
                                    <Input
                                      type="date"
                                      className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                                      {...startDateField}
                                    />
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
                                    <Input
                                      type="date"
                                      className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                                      {...endDateField}
                                    />
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
                                form.formState.errors.exclusivity_rules?.[index]
                                  ?.platforms?.message
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
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => router.push("/deals")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto sm:min-w-40"
              >
                {isSubmitting ? "Creating deal..." : "Create deal"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
