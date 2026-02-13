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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const deliverableFormSchema = z.object({
  platform: z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK", "OTHER"]),
  type: z.enum(["REEL", "POST", "STORY", "SHORT", "VIDEO", "OTHER"]),
  quantity: z.number().int().positive(),
  scheduled_date: z.string().optional(),
});

type DeliverableFormValues = z.infer<typeof deliverableFormSchema>;

type DeliverableFormProps = {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

function ScheduledDatePicker({
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

export function DeliverableForm({
  dealId,
  open,
  onOpenChange,
  onCreated,
}: DeliverableFormProps) {
  const createDeliverableMutation = trpc.deliverables.create.useMutation({
    onSuccess: () => {
      toast.success("Deliverable added.", { duration: 2500 });
      onCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Could not create deliverable.", {
        duration: 3000,
      });
    },
  });

  const form = useForm<DeliverableFormValues>({
    resolver: zodResolver(deliverableFormSchema),
    defaultValues: {
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 1,
      scheduled_date: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        platform: "INSTAGRAM",
        type: "REEL",
        quantity: 1,
        scheduled_date: undefined,
      });
    }
  }, [form, open]);

  const onSubmit = (values: DeliverableFormValues) => {
    createDeliverableMutation.mutate({
      deal_id: dealId,
      platform: values.platform,
      type: values.type,
      quantity: values.quantity,
      scheduled_at: values.scheduled_date
        ? new Date(`${values.scheduled_date}T00:00:00`).toISOString()
        : null,
      status: "DRAFT",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Deliverable</DialogTitle>
          <DialogDescription>
            Add one deliverable item for this deal.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">INSTAGRAM</SelectItem>
                      <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                      <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                      <SelectItem value="OTHER">OTHER</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="REEL">REEL</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="STORY">STORY</SelectItem>
                      <SelectItem value="SHORT">SHORT</SelectItem>
                      <SelectItem value="VIDEO">VIDEO</SelectItem>
                      <SelectItem value="OTHER">OTHER</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={field.value ?? 1}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value || "1"))
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
              name="scheduled_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled date</FormLabel>
                  <FormControl>
                    <ScheduledDatePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createDeliverableMutation.isPending}>
                Add Deliverable
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
