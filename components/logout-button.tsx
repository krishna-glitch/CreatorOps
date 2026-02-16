"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error logging out:", error);
      setLoading(false);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size={className?.includes('w-full') ? 'default' : 'icon'}
      onClick={handleLogout}
      loading={loading}
      className={cn("dash-shell-icon-btn", className)}
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="h-4 w-4 mr-2" />
      {className?.includes('w-full') ? 'Log out' : null}
    </Button>
  );
}
