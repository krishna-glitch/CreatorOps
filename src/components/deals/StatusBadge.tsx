import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getDealStatusTone,
  getStatusBadgeClasses,
} from "@/src/lib/utils/status-utils";

type StatusBadgeProps = {
  status: string | null;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status ?? "UNKNOWN";
  const tone = getDealStatusTone(normalizedStatus);

  return (
    <Badge
      variant="outline"
      className={cn(getStatusBadgeClasses(tone), className)}
    >
      {normalizedStatus}
    </Badge>
  );
}

export {
  formatDealCurrency,
  formatDealDate,
} from "@/src/lib/utils/format-utils";
