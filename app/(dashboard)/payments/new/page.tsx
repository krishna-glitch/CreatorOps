"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { VoiceCommandButton } from "@/src/components/voice/VoiceCommandButton";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

const createPaymentFormSchema = z
  .object({
    deal_id: z.string().uuid({ message: "Please select a deal" }),
    amount: z.number().positive({ message: "Amount must be greater than 0" }),
    currency: z.enum(["USD", "INR", "OTHER"]),
    kind: z.enum(["DEPOSIT", "FINAL", "PARTIAL"]),
    expected_date: z.string().optional(),
    payment_method: z.enum(["PAYPAL", "WIRE", "VENMO", "ZELLE", "OTHER"]),
    mark_as_paid: z.boolean(),
    paid_at: z.string().optional(),
  })
  .refine(
    (values) =>
      !values.mark_as_paid || (values.paid_at?.trim().length ?? 0) > 0,
    {
      message: "Paid date is required when Mark as Paid is enabled",
      path: ["paid_at"],
    },
  );

type CreatePaymentFormValues = z.infer<typeof createPaymentFormSchema>;

function DateInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Input
      type="date"
      value={value ?? ""}
      onChange={(event) => {
        const nextValue = event.target.value;
        onChange(nextValue.length > 0 ? nextValue : undefined);
      }}
    />
  );
}

export default function NewPaymentPage() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const searchParams = useSearchParams();
  const initialDealId = searchParams.get("dealId") ?? "";
  const { defaultCurrency } = useDefaultCurrency();

  const { data: dealsData, isLoading: isLoadingDeals } =
    trpc.deals.list.useQuery({ limit: 100 });

  const createPaymentMutation = trpc.payments.create.useMutation({
    onSuccess: async (_payment, variables) => {
      await trpcUtils.analytics.getDashboardStats.invalidate();
      toast.success("Payment added.", { duration: 2500 });
      router.push(`/deals/${variables.deal_id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Could not create payment.", {
        duration: 3000,
      });
    },
  });

  const form = useForm<CreatePaymentFormValues>({
    resolver: zodResolver(createPaymentFormSchema),
    defaultValues: {
      deal_id: initialDealId,
      amount: undefined,
      currency: defaultCurrency,
      kind: "DEPOSIT",
      expected_date: undefined,
      payment_method: "WIRE",
      mark_as_paid: false,
      paid_at: undefined,
    },
  });

  const markAsPaid = form.watch("mark_as_paid");
  const deals = dealsData?.items ?? [];
  const hasDeals = deals.length > 0;

  useEffect(() => {
    if (!form.formState.dirtyFields.currency) {
      form.setValue("currency", defaultCurrency, { shouldDirty: false });
    }
  }, [defaultCurrency, form]);

  const executeVoiceCommand = async (command: ParsedCommand) => {
    const matchDealByBrand = (brandName: string | undefined) => {
      if (!brandName) {
        return null;
      }
      const normalized = brandName.toLowerCase().trim();
      return (
        deals.find((deal) => deal.brand?.name.toLowerCase() === normalized) ??
        deals.find((deal) =>
          deal.brand?.name.toLowerCase().includes(normalized),
        ) ??
        null
      );
    };

    if (command.intent === "ADD_PAYMENT") {
      if (command.entities.amount && command.entities.amount > 0) {
        form.setValue("amount", command.entities.amount, { shouldDirty: true });
      }
      if (command.entities.currency) {
        form.setValue("currency", command.entities.currency, {
          shouldDirty: true,
        });
      }

      const matchedDeal = matchDealByBrand(command.entities.brand);
      if (matchedDeal) {
        form.setValue("deal_id", matchedDeal.id, {
          shouldDirty: true,
        });
      }

      form.setValue("mark_as_paid", true, {
        shouldDirty: true,
      });
      toast.success("Voice command applied to payment form.", {
        duration: 2200,
      });
      return;
    }

    if (command.intent === "MARK_PAID") {
      const matchedDeal = matchDealByBrand(command.entities.brand);
      if (matchedDeal) {
        form.setValue("deal_id", matchedDeal.id, {
          shouldDirty: true,
        });
      }
      form.setValue("mark_as_paid", true, {
        shouldDirty: true,
      });
      toast.success("Payment marked as paid in form.", {
        duration: 2200,
      });
      return;
    }

    if (command.intent === "OPEN_NEW_DEAL_FORM") {
      router.push("/deals/new");
      return;
    }

    toast.error("This voice command isn't supported on this page.", {
      duration: 2800,
    });
  };

  const onSubmit = (values: CreatePaymentFormValues) => {
    createPaymentMutation.mutate({
      deal_id: values.deal_id,
      amount: values.amount,
      currency: values.currency,
      kind: values.kind,
      status: values.mark_as_paid ? "PAID" : "EXPECTED",
      expected_date: values.expected_date
        ? new Date(`${values.expected_date}T00:00:00`).toISOString()
        : null,
      paid_at:
        values.mark_as_paid && values.paid_at
          ? new Date(`${values.paid_at}T00:00:00`).toISOString()
          : null,
      payment_method: values.payment_method,
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <VoiceCommandButton
        brandVocabulary={deals
          .map((deal) => deal.brand?.name ?? "")
          .filter((name) => name.length > 0)}
        disabled={createPaymentMutation.isPending}
        onExecuteCommand={executeVoiceCommand}
      />
      <div className="rounded-2xl border dash-border dash-bg-card shadow-sm dash-border dash-bg-panel">
        <div className="border-b dash-border px-5 py-5 sm:px-8 dash-border">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Payments
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Add Payment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a deal and record the payment details.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: Tap the floating mic button to use voice commands.
          </p>
        </div>

        {!isLoadingDeals && !hasDeals ? (
          <div className="space-y-4 px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-sm text-muted-foreground">
              No deals found. Create a deal first before adding payments.
            </p>
            <div className="flex gap-3">
              <Link
                href="/deals/new"
                className={buttonVariants({ variant: "default" })}
              >
                Create Deal
              </Link>
              <Link
                href="/deals"
                className={buttonVariants({ variant: "outline" })}
              >
                Back to Deals
              </Link>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5 px-5 py-6 sm:px-8 sm:py-8"
            >
              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoadingDeals}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingDeals
                                ? "Loading deals..."
                                : "Select a deal"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            {deal.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          field.onChange(
                            nextValue === "" ? undefined : Number(nextValue),
                          );
                        }}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="OTHER">OTHER</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kind</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select kind" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DEPOSIT">DEPOSIT</SelectItem>
                          <SelectItem value="FINAL">FINAL</SelectItem>
                          <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="expected_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected date</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PAYPAL">PAYPAL</SelectItem>
                          <SelectItem value="WIRE">WIRE</SelectItem>
                          <SelectItem value="VENMO">VENMO</SelectItem>
                          <SelectItem value="ZELLE">ZELLE</SelectItem>
                          <SelectItem value="OTHER">OTHER</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="mark_as_paid"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 rounded-md border dash-border px-3 py-2 dash-border">
                      <input
                        id="mark-as-paid"
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                        className="h-4 w-4 accent-foreground"
                      />
                      <label htmlFor="mark-as-paid" className="text-sm">
                        Mark as Paid
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {markAsPaid ? (
                <FormField
                  control={form.control}
                  name="paid_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid at</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  loading={createPaymentMutation.isPending}
                  disabled={!hasDeals}
                >
                  Add Payment
                </Button>
                <Link
                  href="/dashboard"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
