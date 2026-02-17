import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DeadlineState =
  | "COMPLETED"
  | "ON_TRACK"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "LATE"
  | "LATE_1D"
  | "LATE_3D";

type DeadlineStateBadgeProps = {
  state: DeadlineState;
  reason?: string | null;
  className?: string;
};

function getDeadlineStateMeta(state: DeadlineState) {
  if (state === "COMPLETED") {
    return {
      label: "Completed",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-100 text-emerald-700",
    };
  }

  if (state === "ON_TRACK") {
    return {
      label: "On Track",
      icon: Clock3,
      className: "border-blue-200 bg-blue-100 text-blue-700",
    };
  }

  if (state === "DUE_SOON") {
    return {
      label: "Due Soon",
      icon: TriangleAlert,
      className: "border-amber-200 bg-amber-100 text-amber-700",
    };
  }

  if (state === "DUE_TODAY") {
    return {
      label: "Due Today",
      icon: AlertTriangle,
      className: "border-orange-200 bg-orange-100 text-orange-700",
    };
  }

  return {
    label:
      state === "LATE"
        ? "Late"
        : state === "LATE_1D"
          ? "Late 1-3d"
          : "Late 3d+",
    icon: AlertTriangle,
    className: "border-rose-200 bg-rose-100 text-rose-700",
  };
}

export function DeadlineStateBadge({
  state,
  reason,
  className,
}: DeadlineStateBadgeProps) {
  const meta = getDeadlineStateMeta(state);
  const Icon = meta.icon;

  return (
    <Badge
      variant="outline"
      className={`${meta.className}${className ? ` ${className}` : ""}`}
      title={reason ?? undefined}
    >
      <Icon className="mr-1 h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}
