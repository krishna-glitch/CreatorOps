"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
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
      size="sm"
      onClick={handleLogout}
      loading={loading}
      className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Log out
    </Button>
  );
}
