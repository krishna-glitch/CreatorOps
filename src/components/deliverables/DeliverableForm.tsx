"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import type { Conflict } from "@/src/server/domain/services/ConflictDetector";

const deliverableFormSchema = z.object({
  category_path: z.string().trim().min(1, "Category is required"),
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
  const trpcUtils = trpc.useUtils();
  const [pendingConflicts, setPendingConflicts] = useState<Conflict[]>([]);
  const [deliverableDraftId, setDeliverableDraftId] = useState<string | null>(
    null,
  );
  const [conflictSessionId, setConflictSessionId] = useState<string | null>(
    null,
  );
  const [pendingValues, setPendingValues] =
    useState<DeliverableFormValues | null>(null);

  const createDeliverableMutation = trpc.deliverables.create.useMutation({
    onSuccess: async (result) => {
      if (result.requires_acknowledgement) {
        setPendingConflicts(result.conflicts);
        toast.warning(
          "Exclusivity conflicts detected. Review before proceeding.",
          {
            duration: 3500,
          },
        );
        return;
      }

      if (result.proceeded_despite_conflict) {
        toast.warning("Deliverable added despite exclusivity conflict.", {
          duration: 3000,
        });
      } else {
        toast.success("Deliverable added.", { duration: 2500 });
      }
      setPendingConflicts([]);
      setPendingValues(null);
      await Promise.all([
        trpcUtils.analytics.getDashboardStats.invalidate(),
        trpcUtils.conflicts.list.invalidate(),
        trpcUtils.conflicts.summary.invalidate(),
      ]);
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
      category_path: "",
      platform: "INSTAGRAM",
      type: "REEL",
      quantity: 1,
      scheduled_date: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        category_path: "",
        platform: "INSTAGRAM",
        type: "REEL",
        quantity: 1,
        scheduled_date: undefined,
      });
      setPendingConflicts([]);
      setPendingValues(null);
      setDeliverableDraftId(null);
      setConflictSessionId(null);
    }
  }, [form, open]);

  const ensureDraftIds = () => {
    if (!deliverableDraftId) {
      setDeliverableDraftId(crypto.randomUUID());
    }
    if (!conflictSessionId) {
      setConflictSessionId(crypto.randomUUID());
    }
  };

  const toCreatePayload = (
    values: DeliverableFormValues,
    acknowledgeConflicts: boolean,
  ) => {
    ensureDraftIds();
    const draftId = deliverableDraftId ?? crypto.randomUUID();
    const sessionId = conflictSessionId ?? crypto.randomUUID();

    if (!deliverableDraftId) {
      setDeliverableDraftId(draftId);
    }
    if (!conflictSessionId) {
      setConflictSessionId(sessionId);
    }

    return {
      deal_id: dealId,
      deliverable_id: draftId,
      conflict_session_id: sessionId,
      acknowledge_conflicts: acknowledgeConflicts,
      category_path: values.category_path.trim(),
      platform: values.platform,
      type: values.type,
      quantity: values.quantity,
      scheduled_at: values.scheduled_date
        ? new Date(`${values.scheduled_date}T00:00:00`).toISOString()
        : null,
      status: "DRAFT" as const,
    };
  };

  const onSubmit = (values: DeliverableFormValues) => {
    setPendingValues(values);
    createDeliverableMutation.mutate(toCreatePayload(values, false));
  };

  const handleCreateAnyway = () => {
    if (!pendingValues) {
      return;
    }
    createDeliverableMutation.mutate(toCreatePayload(pendingValues, true));
  };

  const handleReschedule = () => {
    setPendingConflicts([]);
    toast.info("Update the scheduled date and submit again.", {
      duration: 2500,
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
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            {pendingConflicts.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="text-sm font-semibold">Exclusivity Warning</p>
                <p className="mt-1 text-xs">
                  This deliverable overlaps existing exclusivity rules.
                </p>
                <div className="mt-3 space-y-2">
                  {pendingConflicts.map((conflict) => (
                    <div
                      key={`${conflict.conflicting_rule_id}-${conflict.new_deal_or_deliverable_id}`}
                      className="rounded border border-amber-300/70 dash-bg-card p-2"
                    >
                      <p className="text-xs font-medium">
                        Rule: {conflict.overlap.category.rule} (
                        {conflict.overlap.category.scope})
                      </p>
                      <p className="text-xs">
                        Platform overlap:{" "}
                        {conflict.overlap.platforms.matched.join(", ")}
                      </p>
                      <ul className="mt-1 list-disc pl-4 text-xs">
                        {conflict.suggested_resolutions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="category_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="Tech/Smartphones" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              {pendingConflicts.length > 0 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReschedule}
                  >
                    Reschedule and Recheck
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreateAnyway}
                    loading={createDeliverableMutation.isPending}
                  >
                    Create Anyway
                  </Button>
                </>
              ) : null}
              <Button
                type="submit"
                loading={createDeliverableMutation.isPending}
              >
                Add Deliverable
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
