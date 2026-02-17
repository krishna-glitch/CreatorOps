"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { useDefaultCurrency } from "@/src/hooks/useDefaultCurrency";

const paymentFormSchema = z
  .object({
    amount: z.number().positive(),
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

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

type PaymentFormProps = {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

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

export function PaymentForm({
  dealId,
  open,
  onOpenChange,
  onCreated,
}: PaymentFormProps) {
  const trpcUtils = trpc.useUtils();
  const { defaultCurrency } = useDefaultCurrency();
  const createPaymentMutation = trpc.payments.create.useMutation({
    onSuccess: async () => {
      await trpcUtils.analytics.getDashboardStats.invalidate();
      toast.success("Payment added.", { duration: 2500 });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Could not create payment.", {
        duration: 3000,
      });
    },
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
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

  useEffect(() => {
    if (!open) {
      form.reset({
        amount: undefined,
        currency: defaultCurrency,
        kind: "DEPOSIT",
        expected_date: undefined,
        payment_method: "WIRE",
        mark_as_paid: false,
        paid_at: undefined,
      });
    }
  }, [defaultCurrency, form, open]);

  useEffect(() => {
    if (!form.formState.dirtyFields.currency) {
      form.setValue("currency", defaultCurrency, { shouldDirty: false });
    }
  }, [defaultCurrency, form]);

  const onSubmit = (values: PaymentFormValues) => {
    createPaymentMutation.mutate({
      deal_id: dealId,
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
      payment_method: values.payment_method ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
          <DialogDescription>
            Add a payment entry for this deal.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
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

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <FormField
              control={form.control}
              name="expected_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected date</FormLabel>
                  <FormControl>
                    <DateInput value={field.value} onChange={field.onChange} />
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
                  <Select value={field.value} onValueChange={field.onChange}>
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

            <FormField
              control={form.control}
              name="mark_as_paid"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                    <input
                      id="mark-as-paid"
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="h-4 w-4 accent-foreground"
                    />
                    <Label htmlFor="mark-as-paid">Mark as Paid</Label>
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

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createPaymentMutation.isPending}>
                Add Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
