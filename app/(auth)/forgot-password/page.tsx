"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/login`,
        },
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage(
          "If an account exists for that email, a reset link has been sent.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-shell flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-tight gold-text">
            Reset password
          </h1>
          <p className="mt-2 text-sm dash-text-muted">
            Enter your account email to receive a reset link.
          </p>
        </div>

        <div className="pillowy-card dash-card rounded-xl border p-8">
          {error && (
            <div className="dash-chip-tone-red mb-4 rounded-lg border px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="dash-chip-tone-green mb-4 rounded-lg border px-4 py-3 text-sm">
              {message}
            </div>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full" loading={isLoading}>
              Send reset link
            </Button>
          </form>
        </div>

        <p className="text-center text-sm dash-text-muted">
          Back to{" "}
          <Link
            href="/login"
            className="font-medium gold-text hover:underline"
          >
            sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
