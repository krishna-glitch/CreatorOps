"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
});

type CreateDealFormValues = z.infer<typeof createDealFormSchema>;

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
    },
  });

  const onSubmit = (values: CreateDealFormValues) => {
    createDealMutation.mutate(values);
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
