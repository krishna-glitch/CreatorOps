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
import { trpc } from "@/lib/trpc/client";

const reworkCycleCompletionSchema = z.object({
  hours: z.number().int().min(0).max(200).optional(),
  minutes: z.number().int().min(0).max(59).optional(),
});

type ReworkCycleCompletionValues = z.infer<typeof reworkCycleCompletionSchema>;

type ReworkCycleCompleteFormProps = {
  cycleId: string;
  cycleNumber: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function ReworkCycleCompleteForm({
  cycleId,
  cycleNumber,
  open,
  onOpenChange,
  onCompleted,
}: ReworkCycleCompleteFormProps) {
  const completeReworkMutation = trpc.feedback.completeReworkCycle.useMutation({
    onSuccess: () => {
      toast.success(`Rework cycle #${cycleNumber} marked complete.`, {
        duration: 2500,
      });
      onCompleted?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Could not complete rework cycle.", {
        duration: 3000,
      });
    },
  });

  const form = useForm<ReworkCycleCompletionValues>({
    resolver: zodResolver(reworkCycleCompletionSchema),
    defaultValues: {
      hours: undefined,
      minutes: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        hours: undefined,
        minutes: undefined,
      });
    }
  }, [form, open]);

  const onSubmit = (values: ReworkCycleCompletionValues) => {
    const hours = values.hours ?? 0;
    const minutes = values.minutes ?? 0;
    const hasTime = hours > 0 || minutes > 0;

    completeReworkMutation.mutate({
      cycle_id: cycleId,
      time_spent_minutes: hasTime ? hours * 60 + minutes : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Rework Cycle #{cycleNumber}</DialogTitle>
          <DialogDescription>
            How long did this revision take? You can skip if unknown.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="200"
                        step="1"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value === "" ? undefined : Number(value));
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
                name="minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minutes</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        step="1"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value === "" ? undefined : Number(value));
                        }}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={completeReworkMutation.isPending}>
                Complete Rework
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
