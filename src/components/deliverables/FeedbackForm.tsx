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

const feedbackFormSchema = z.object({
  feedback_type: z.enum([
    "CREATIVE_DIRECTION",
    "COMPLIANCE",
    "BRAND_VOICE",
    "EDITING",
    "COPY",
    "TIMING",
    "TECHNICAL",
    "OTHER",
  ]),
  severity: z.number().int().min(1).max(10),
  message_raw: z.string().trim().min(1).max(10000),
  summary: z.string().trim().max(2000).optional(),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

type FeedbackFormProps = {
  dealId: string;
  deliverableId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
};

export function FeedbackForm({
  dealId,
  deliverableId,
  open,
  onOpenChange,
  onCreated,
}: FeedbackFormProps) {
  const createFeedbackMutation = trpc.feedback.create.useMutation({
    onSuccess: (result) => {
      toast.success("Feedback logged and rework cycle created.", {
        duration: 2500,
      });
      if (result.warningAlert) {
        toast.warning(
          `${result.warningAlert.title}: ${result.warningAlert.message}`,
          {
            duration: 5000,
          },
        );
      }
      onCreated?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Could not add feedback.", {
        duration: 3000,
      });
    },
  });

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      feedback_type: "CREATIVE_DIRECTION",
      severity: 5,
      message_raw: "",
      summary: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        feedback_type: "CREATIVE_DIRECTION",
        severity: 5,
        message_raw: "",
        summary: "",
      });
    }
  }, [form, open]);

  const onSubmit = (values: FeedbackFormValues) => {
    createFeedbackMutation.mutate({
      deal_id: dealId,
      deliverable_id: deliverableId,
      feedback_type: values.feedback_type,
      severity: values.severity,
      message_raw: values.message_raw,
      summary: values.summary ? values.summary : null,
      sentiment: "NEUTRAL",
      status: "OPEN",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Feedback</DialogTitle>
          <DialogDescription>
            Log brand feedback and start a new rework cycle for this
            deliverable.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="feedback_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feedback type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select feedback type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CREATIVE_DIRECTION">
                        CREATIVE_DIRECTION
                      </SelectItem>
                      <SelectItem value="COMPLIANCE">COMPLIANCE</SelectItem>
                      <SelectItem value="BRAND_VOICE">BRAND_VOICE</SelectItem>
                      <SelectItem value="EDITING">EDITING</SelectItem>
                      <SelectItem value="COPY">COPY</SelectItem>
                      <SelectItem value="TIMING">TIMING</SelectItem>
                      <SelectItem value="TECHNICAL">TECHNICAL</SelectItem>
                      <SelectItem value="OTHER">OTHER</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity: {field.value}</FormLabel>
                  <FormControl>
                    <Input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value || "5"))
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
              name="message_raw"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (verbatim)</FormLabel>
                  <FormControl>
                    <textarea
                      rows={4}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Paste exact client feedback..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary (optional)</FormLabel>
                  <FormControl>
                    <textarea
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Optional concise summary..."
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
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
              <Button type="submit" loading={createFeedbackMutation.isPending}>
                Save Feedback
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
