"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ParsedCommand } from "@/src/lib/voice/commandParser";

type CommandConfirmationProps = {
  open: boolean;
  transcript: string;
  parsedCommand: ParsedCommand | null;
  isExecuting?: boolean;
  onExecute: () => void;
  onCancel: () => void;
  onTryAgain: () => void;
};

function renderPreview(parsedCommand: ParsedCommand) {
  const { intent, entities } = parsedCommand;

  if (intent === "CREATE_DEAL") {
    return (
      <ul className="space-y-1 text-sm">
        <li>• Brand: {entities.brand ?? "Unknown"}</li>
        <li>
          • Amount:{" "}
          {entities.amount ? `$${entities.amount.toLocaleString()}` : "N/A"}
        </li>
        <li>
          • Deliverables:{" "}
          {entities.deliverables.length > 0
            ? entities.deliverables
                .map((d) => `${d.quantity} ${d.platform} ${d.type}`)
                .join(", ")
            : "None"}
        </li>
      </ul>
    );
  }

  if (intent === "MARK_PAID") {
    return (
      <p className="text-sm">
        Marking {entities.brand ?? "this deal"} as paid.
      </p>
    );
  }

  if (intent === "ADD_PAYMENT") {
    return (
      <ul className="space-y-1 text-sm">
        <li>• Brand: {entities.brand ?? "Unknown"}</li>
        <li>
          • Payment:{" "}
          {entities.amount ? `$${entities.amount.toLocaleString()}` : "N/A"}
        </li>
      </ul>
    );
  }

  if (intent === "MARK_POSTED") {
    return (
      <p className="text-sm">
        Marking {entities.brand ?? "brand"}{" "}
        {entities.deliverableType ?? "deliverable"} as posted.
      </p>
    );
  }

  if (intent === "SHOW_UNPAID_DEALS") {
    return <p className="text-sm">Filtering list to show unpaid deals.</p>;
  }

  if (intent === "OPEN_NEW_DEAL_FORM") {
    return <p className="text-sm">Opening the new deal form.</p>;
  }

  return <p className="text-sm">I didn't understand that. Try again?</p>;
}

export function CommandConfirmation({
  open,
  transcript,
  parsedCommand,
  isExecuting,
  onExecute,
  onCancel,
  onTryAgain,
}: CommandConfirmationProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Voice Command</DialogTitle>
          <DialogDescription>
            I heard:{" "}
            <span className="font-semibold text-foreground">
              "{transcript}"
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border dash-border p-3">
          {parsedCommand ? renderPreview(parsedCommand) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onTryAgain}>
            Try Again
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onExecute}
            disabled={!parsedCommand || parsedCommand.intent === "UNKNOWN"}
            loading={isExecuting}
          >
            Execute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
