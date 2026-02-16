"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "creatorops-theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  const body = document.body;
  const isDark = theme === "dark";

  root.classList.toggle("dark", isDark);
  body.classList.toggle("dark", isDark);

  root.setAttribute("data-theme", theme);
  body.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const rootIsDark = document.documentElement.classList.contains("dark");
    setTheme(rootIsDark ? "dark" : "light");
  }, []);

  if (!mounted) return null;

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed right-4 bottom-[88px] z-50"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      onClick={() => {
        const updatedTheme = nextTheme;
        setTheme(updatedTheme);
        applyTheme(updatedTheme);
        localStorage.setItem(STORAGE_KEY, updatedTheme);
      }}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
