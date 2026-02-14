"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
    (value) => new Date(value.end_date).getTime() > new Date(value.start_date).getTime(),
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
  status: z.enum(["INBOUND", "NEGOTIATING", "AGREED", "PAID"], {
    message: "Please select a status",
  }),
  exclusivity_rules: z.array(exclusivityRuleFormSchema).default([]),
});

type CreateDealFormValues = z.input<typeof createDealFormSchema>;

function getCreateDealErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Brand not found")) {
      return "Selected brand was not found. Please refresh and try again.";
    }

    if (error.message.includes("UNAUTHORIZED")) {
      return "Your session expired. Please sign in again.";
    }
  }

  return "Could not create the deal. Please check your inputs and try again.";
}

export default function NewDealPage() {
  const router = useRouter();
  const platformOptions = ["INSTAGRAM", "YOUTUBE", "TIKTOK"] as const;

  const { data: brands, isLoading: isLoadingBrands } =
    trpc.brands.list.useQuery({ limit: 100 });

  const createDealMutation = trpc.deals.create.useMutation({
    onSuccess: () => {
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

  const isSubmitting = createDealMutation.isPending;
  const brandItems = brands?.items ?? [];
  const hasBrands = brandItems.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 px-5 py-5 sm:px-8 dark:border-gray-800">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Deal Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Create New Deal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add core details to create and track a brand deal.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-7 px-5 py-6 sm:px-8 sm:py-8"
          >
            <div className="grid grid-cols-1 gap-5">
              <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
                <p className="text-sm font-medium">Basics</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start with brand and a short deal title.
                </p>

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
                            ) : brandItems.length > 0 ? (
                              brandItems.map((brand) => (
                                <SelectItem key={brand.id} value={brand.id}>
                                  {brand.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                No brands found
                              </SelectItem>
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

              <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
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
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Exclusivity Rules</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add one or more exclusivity constraints for this deal.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={addExclusivityRule}>
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
                disabled={isSubmitting || !hasBrands}
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
