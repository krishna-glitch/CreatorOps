"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploader, type MediaAssetType } from "@/src/components/media/FileUploader";
import { ScriptEditor } from "@/src/components/media/ScriptEditor";

type MediaAssetStatus =
  | "DRAFT"
  | "SUBMITTED_FOR_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FINAL";

type MediaAssetItem = {
  id: string;
  assetType: MediaAssetType;
  versionNumber: number;
  fileName: string;
  uploadedAt: string | Date;
  status: MediaAssetStatus;
  approvalNotes?: string | null;
  thumbnailUrl?: string | null;
  scriptPreview?: string | null;
  filePath: string;
  approvedBy?: string | null;
  approvalTimeline?: Array<{
    id: string;
    status: MediaAssetStatus;
    at: string | Date;
    notes?: string | null;
    actorLabel?: string | null;
  }>;
};

type DeliverableMediaSectionProps = {
  deliverableId: string;
  assets: MediaAssetItem[];
  getSignedUrl: (input: {
    deliverableId: string;
    assetType: MediaAssetType;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  }) => Promise<{
    signedUrl: string;
    path: string;
    method?: "PUT" | "POST";
    headers?: Record<string, string>;
  }>;
  saveMetadata: (input: {
    deliverableId: string;
    assetType: MediaAssetType;
    fileName: string;
    filePath: string;
    fileSizeBytes: number;
    mimeType: string;
    durationSeconds: number | null;
    dimensions: { width: number; height: number } | null;
  }) => Promise<void>;
  onDeleteAsset: (assetId: string, path: string) => Promise<void>;
  onDownloadAsset: (assetId: string, path: string) => Promise<void>;
  onSubmitForApproval?: (assetId: string) => Promise<void>;
  onApproveAsset?: (assetId: string) => Promise<void>;
  onRejectAsset?: (input: { assetId: string; notes: string }) => Promise<void>;
  onOpenFeedback?: (assetId: string) => void;
  onUploaded?: () => void;
};

const DISPLAY_GROUPS: Array<{ type: MediaAssetType; label: string }> = [
  { type: "SCRIPT", label: "Script" },
  { type: "RAW_VIDEO", label: "Raw Video" },
  { type: "EDITED_VIDEO", label: "Edited Video" },
  { type: "THUMBNAIL", label: "Thumbnail" },
];

function getStatusBadgeClassName(status: MediaAssetStatus) {
  if (status === "APPROVED" || status === "FINAL") {
    return "border-transparent bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }

  if (status === "REJECTED") {
    return "border-transparent bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }

  if (status === "SUBMITTED_FOR_REVIEW") {
    return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }

  return "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

function toLocalDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function getScriptPreview(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return value.slice(0, 200);
}

function sortByLatestVersion(assets: MediaAssetItem[]) {
  return [...assets].sort((a, b) => b.versionNumber - a.versionNumber);
}

export function DeliverableMediaSection({
  assets,
  deliverableId,
  getSignedUrl,
  onDeleteAsset,
  onDownloadAsset,
  onSubmitForApproval,
  onApproveAsset,
  onRejectAsset,
  onOpenFeedback,
  onUploaded,
  saveMetadata,
}: DeliverableMediaSectionProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadAssetType, setUploadAssetType] = useState<MediaAssetType>("RAW_VIDEO");
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [actingAssetId, setActingAssetId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MediaAssetItem | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<MediaAssetType, MediaAssetItem[]>();
    DISPLAY_GROUPS.forEach((group) => map.set(group.type, []));

    for (const asset of assets) {
      if (!map.has(asset.assetType)) {
        continue;
      }
      map.get(asset.assetType)?.push(asset);
    }

    for (const [key, groupAssets] of map.entries()) {
      map.set(key, sortByLatestVersion(groupAssets));
    }

    return map;
  }, [assets]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white/60 p-3 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Content Files</h3>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setScriptEditorOpen(true)}>
            Write Script
          </Button>
          <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
            Upload New File
          </Button>
        </div>
      </div>

      {DISPLAY_GROUPS.map((group) => {
        const items = grouped.get(group.type) ?? [];

        return (
          <div key={group.type} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {group.label}
            </p>

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 px-3 py-2 text-xs text-muted-foreground dark:border-gray-800">
                No {group.label.toLowerCase()} uploaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((asset) => (
                  <article
                    key={asset.id}
                    className="rounded-md border border-gray-200 p-3 dark:border-gray-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium">{asset.fileName}</p>
                        <Badge variant="outline">v{asset.versionNumber}</Badge>
                        <Badge className={getStatusBadgeClassName(asset.status)}>
                          {asset.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {toLocalDate(asset.uploadedAt)}
                      </p>
                    </div>

                    {asset.approvalNotes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Notes: {asset.approvalNotes}
                      </p>
                    ) : null}
                    {asset.approvedBy ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Approved by: {asset.approvedBy}
                      </p>
                    ) : null}

                    {group.type === "SCRIPT" ? (
                      <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-2 text-xs dark:border-gray-800 dark:bg-gray-900">
                        {getScriptPreview(asset.scriptPreview) ?? "No preview available."}
                      </pre>
                    ) : null}

                    {(group.type === "RAW_VIDEO" ||
                      group.type === "EDITED_VIDEO" ||
                      group.type === "THUMBNAIL") &&
                    asset.thumbnailUrl ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={`${asset.fileName} preview`}
                        className="mt-2 h-24 w-40 rounded-md border border-gray-200 object-cover dark:border-gray-800"
                      />
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => onDownloadAsset(asset.id, asset.filePath)}
                      >
                        Download
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deletingAssetId === asset.id}
                        onClick={async () => {
                          setDeletingAssetId(asset.id);
                          try {
                            await onDeleteAsset(asset.id, asset.filePath);
                          } finally {
                            setDeletingAssetId(null);
                          }
                        }}
                      >
                        Delete
                      </Button>
                      {asset.status === "DRAFT" && onSubmitForApproval ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingAssetId === asset.id}
                          onClick={async () => {
                            setActingAssetId(asset.id);
                            try {
                              await onSubmitForApproval(asset.id);
                              onUploaded?.();
                            } finally {
                              setActingAssetId(null);
                            }
                          }}
                        >
                          Submit for Approval
                        </Button>
                      ) : null}
                      {asset.status === "SUBMITTED_FOR_REVIEW" && onApproveAsset ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={actingAssetId === asset.id}
                          onClick={async () => {
                            setActingAssetId(asset.id);
                            try {
                              await onApproveAsset(asset.id);
                              onUploaded?.();
                            } finally {
                              setActingAssetId(null);
                            }
                          }}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {asset.status === "SUBMITTED_FOR_REVIEW" && onRejectAsset ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={actingAssetId === asset.id}
                          onClick={() => {
                            setRejectTarget(asset);
                            setRejectNotes(asset.approvalNotes ?? "");
                          }}
                        >
                          Reject
                        </Button>
                      ) : null}
                      {asset.status === "REJECTED" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadAssetType(asset.assetType);
                            setUploadOpen(true);
                          }}
                        >
                          Upload New Version
                        </Button>
                      ) : null}
                      {onOpenFeedback ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenFeedback(asset.id)}
                        >
                          Link Feedback
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
                      <p className="text-xs font-medium text-muted-foreground">
                        Approval Timeline
                      </p>
                      <div className="mt-2 space-y-1">
                        {(asset.approvalTimeline && asset.approvalTimeline.length > 0
                          ? asset.approvalTimeline
                          : [
                              {
                                id: `${asset.id}-uploaded`,
                                status: "DRAFT" as const,
                                at: asset.uploadedAt,
                                notes: null,
                                actorLabel: "Creator",
                              },
                              ...(asset.status !== "DRAFT"
                                ? [
                                    {
                                      id: `${asset.id}-current`,
                                      status: asset.status,
                                      at: asset.uploadedAt,
                                      notes: asset.approvalNotes ?? null,
                                      actorLabel: asset.approvedBy ?? "Brand",
                                    },
                                  ]
                                : []),
                            ]
                        ).map((event) => (
                          <div
                            key={event.id}
                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Badge className={getStatusBadgeClassName(event.status)}>
                              {event.status}
                            </Badge>
                            <span>{toLocalDate(event.at)}</span>
                            {event.actorLabel ? <span>• {event.actorLabel}</span> : null}
                            {event.notes ? <span>• {event.notes}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Content File</DialogTitle>
          </DialogHeader>
          <FileUploader
            deliverableId={deliverableId}
            defaultAssetType={uploadAssetType}
            getSignedUrl={getSignedUrl}
            saveMetadata={saveMetadata}
            onUploadSuccess={() => {
              setUploadOpen(false);
              setUploadAssetType("RAW_VIDEO");
              onUploaded?.();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={scriptEditorOpen} onOpenChange={setScriptEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Write Script</DialogTitle>
          </DialogHeader>
          <ScriptEditor
            deliverableId={deliverableId}
            getSignedUrl={async (input) =>
              getSignedUrl({
                ...input,
                assetType: "SCRIPT",
              })
            }
            saveMetadata={async (input) =>
              saveMetadata({
                ...input,
                assetType: "SCRIPT",
              })
            }
            onSaved={onUploaded}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add rejection notes for {rejectTarget?.fileName}.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={5}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              placeholder="Explain what needs to change..."
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!rejectTarget || !onRejectAsset || actingAssetId === rejectTarget?.id}
                onClick={async () => {
                  if (!rejectTarget || !onRejectAsset) {
                    return;
                  }

                  setActingAssetId(rejectTarget.id);
                  try {
                    await onRejectAsset({
                      assetId: rejectTarget.id,
                      notes: rejectNotes.trim(),
                    });
                    setRejectTarget(null);
                    setRejectNotes("");
                    onUploaded?.();
                  } finally {
                    setActingAssetId(null);
                  }
                }}
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
