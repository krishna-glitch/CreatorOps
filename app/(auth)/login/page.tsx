"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setError(null);

    const supabase = createClient();
    let { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError?.message.toLowerCase().includes("email not confirmed")) {
      const confirmResponse = await fetch("/api/auth/dev-confirm-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (confirmResponse.ok) {
        const retryResult = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        authError = retryResult.error;
      }
    }

    if (authError) {
      if (authError.message.toLowerCase().includes("email not confirmed")) {
        setError(
          "Email is not confirmed. In test mode we attempted auto-confirmation but sign-in still failed.",
        );
        return;
      }

      setError(authError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="dashboard-shell flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-tight gold-text">
            Welcome back
          </h1>
          <p className="mt-2 text-sm dash-text-muted">
            Sign in to your CreatorOps account
          </p>
        </div>

        {/* Card */}
        <div className="pillowy-card dash-card rounded-xl border p-8">
          {/* Error Banner */}
          {error && (
            <div className="dash-chip-tone-red mb-6 rounded-lg border px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs dash-text-muted hover:gold-text transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 dash-text-muted hover:gold-text"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm dash-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium gold-text hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
