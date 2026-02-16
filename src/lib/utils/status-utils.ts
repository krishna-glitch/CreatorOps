export type DealStatus = "INBOUND" | "NEGOTIATING" | "AGREED" | "PAID" | "CANCELLED";

export function getDealStatusTone(status: string | null): "green" | "yellow" | "red" | "blue" {
  if (status === "PAID" || status === "AGREED") {
    return "green";
  }
  if (status === "CANCELLED") {
    return "red";
  }
  if (status === "NEGOTIATING") {
    return "yellow";
  }
  return "blue";
}

export function getStatusBadgeClasses(tone: "green" | "yellow" | "red" | "blue") {
  if (tone === "green") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (tone === "yellow") {
    return "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (tone === "red") {
    return "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
  }
  return "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}
