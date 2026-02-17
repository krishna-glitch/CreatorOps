import * as React from "react";
import { cn } from "@/lib/utils";

interface PillowyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "pressed";
}

const PillowyCard = React.forwardRef<HTMLDivElement, PillowyCardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "pressed" ? "pillowy-card-pressed" : "pillowy-card",
          "relative overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);
PillowyCard.displayName = "PillowyCard";

export { PillowyCard };
