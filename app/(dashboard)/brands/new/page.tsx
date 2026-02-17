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
import { trpc } from "@/lib/trpc/client";

const createBrandFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(120, { message: "Name must be at most 120 characters" }),
  notes: z
    .string()
    .trim()
    .max(2000, { message: "Notes must be at most 2000 characters" })
    .optional(),
});

type CreateBrandFormValues = z.infer<typeof createBrandFormSchema>;

function getCreateBrandErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("UNAUTHORIZED")) {
      return "Your session expired. Please sign in again.";
    }
  }

  return "Could not create brand. Please check your inputs and try again.";
}

export default function NewBrandPage() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();

  const createBrandMutation = trpc.brands.create.useMutation({
    onSuccess: () => {
      void trpcUtils.brands.list.invalidate();
      void trpcUtils.analytics.getDashboardStats.invalidate();
      toast.success("Brand created successfully.", { duration: 3000 });
      router.push("/brands");
    },
    onError: (error) => {
      toast.error(getCreateBrandErrorMessage(error), { duration: 3000 });
    },
  });

  const form = useForm<CreateBrandFormValues>({
    resolver: zodResolver(createBrandFormSchema),
    defaultValues: {
      name: "",
      notes: "",
    },
  });

  const onSubmit = (values: CreateBrandFormValues) => {
    createBrandMutation.mutate({
      name: values.name,
    });
  };

  const isSubmitting = createBrandMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="rounded-2xl border dash-border dash-bg-card shadow-sm dash-border dash-bg-panel">
        <div className="border-b dash-border px-5 py-5 sm:px-8 dash-border">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Brand Management
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Create New Brand
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a brand to use in your deals.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-7 px-5 py-6 sm:px-8 sm:py-8"
          >
            <div className="space-y-5 rounded-xl border dash-border p-4 sm:p-5 dash-border">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nike"
                        className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Notes</FormLabel>
                    <FormControl>
                      <textarea
                        placeholder="Optional notes about this brand"
                        className="flex min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-emerald-500 focus-visible:ring-[3px] focus-visible:ring-emerald-500/30"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t dash-border pt-5 sm:flex-row sm:items-center sm:justify-end dash-border">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => router.push("/brands")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto sm:min-w-40"
              >
                {isSubmitting ? "Creating brand..." : "Create brand"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
