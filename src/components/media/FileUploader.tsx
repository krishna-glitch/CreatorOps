"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export type MediaAssetType =
  | "RAW_VIDEO"
  | "EDITED_VIDEO"
  | "THUMBNAIL"
  | "SCRIPT"
  | "CAPTION"
  | "B_ROLL";

type SignedUploadResponse = {
  signedUrl: string;
  path: string;
  method?: "PUT" | "POST";
  headers?: Record<string, string>;
};

type SaveMetadataInput = {
  deliverableId: string;
  assetType: MediaAssetType;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number | null;
  dimensions: { width: number; height: number } | null;
};

type FileUploaderProps = {
  deliverableId: string;
  defaultAssetType?: MediaAssetType;
  maxSizeBytes?: number;
  getSignedUrl: (input: {
    deliverableId: string;
    assetType: MediaAssetType;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  }) => Promise<SignedUploadResponse>;
  saveMetadata: (input: SaveMetadataInput) => Promise<void>;
  onUploadSuccess?: (input: SaveMetadataInput) => void;
};

type UploadPreview = {
  name: string;
  assetType: MediaAssetType;
  fileSizeBytes: number;
  thumbnailUrl: string | null;
  scriptPreview: string | null;
};

const VIDEO_ACCEPT = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
} as const;

const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
} as const;

const SCRIPT_ACCEPT = {
  "text/plain": [".txt", ".md"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
} as const;

const ASSET_OPTIONS: MediaAssetType[] = [
  "RAW_VIDEO",
  "EDITED_VIDEO",
  "THUMBNAIL",
  "SCRIPT",
  "CAPTION",
  "B_ROLL",
];

function getAcceptForAssetType(assetType: MediaAssetType) {
  if (assetType === "THUMBNAIL") {
    return IMAGE_ACCEPT;
  }

  if (assetType === "SCRIPT" || assetType === "CAPTION") {
    return SCRIPT_ACCEPT;
  }

  return VIDEO_ACCEPT;
}

function getReadableSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDropErrorMessage(rejections: FileRejection[]) {
  const firstError = rejections[0]?.errors[0];

  if (!firstError) {
    return "Invalid file. Please try a different file.";
  }

  if (firstError.code === "file-too-large") {
    return "File too large. Maximum allowed size is 100MB.";
  }

  if (firstError.code === "file-invalid-type") {
    return "Wrong file type for selected asset.";
  }

  return firstError.message;
}

function uploadWithProgress(input: {
  url: string;
  file: File;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  onProgress: (value: number) => void;
}) {
  const { file, headers, method, onProgress, url } = input;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new Error("Upload failed. Please retry."));

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`Upload failed with status ${xhr.status}`));
    };

    xhr.send(file);
  });
}

async function extractVideoMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read video metadata."));
    });

    const dimensions = {
      width: video.videoWidth,
      height: video.videoHeight,
    };
    const durationSeconds = Number.isFinite(video.duration)
      ? Math.round(video.duration)
      : null;

    const thumbnailUrl = await new Promise<string | null>((resolve) => {
      const targetTime = Math.min(0.1, Number.isFinite(video.duration) ? video.duration / 2 : 0.1);
      video.currentTime = targetTime;
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      video.onerror = () => resolve(null);
    });

    return { durationSeconds, dimensions, thumbnailUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function extractImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read image metadata."));
    });

    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function extractScriptPreview(file: File) {
  if (file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".md")) {
    return "Preview not available for .docx in browser.";
  }

  const text = await file.text();
  return text.slice(0, 200);
}

export function FileUploader({
  defaultAssetType = "RAW_VIDEO",
  deliverableId,
  getSignedUrl,
  maxSizeBytes = MAX_FILE_SIZE_BYTES,
  onUploadSuccess,
  saveMetadata,
}: FileUploaderProps) {
  const [assetType, setAssetType] = useState<MediaAssetType>(defaultAssetType);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<UploadPreview | null>(null);

  const accept = useMemo(() => getAcceptForAssetType(assetType), [assetType]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null);

      if (fileRejections.length > 0) {
        setError(getDropErrorMessage(fileRejections));
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        return;
      }

      if (file.size > maxSizeBytes) {
        setError("File too large. Maximum allowed size is 100MB.");
        return;
      }

      setIsUploading(true);
      setProgress(0);

      try {
        const signed = await getSignedUrl({
          deliverableId,
          assetType,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        });

        await uploadWithProgress({
          url: signed.signedUrl,
          file,
          method: signed.method ?? "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            ...(signed.headers ?? {}),
          },
          onProgress: setProgress,
        });

        let durationSeconds: number | null = null;
        let dimensions: { width: number; height: number } | null = null;
        let thumbnailUrl: string | null = null;
        let scriptPreview: string | null = null;

        if (assetType === "THUMBNAIL") {
          dimensions = await extractImageDimensions(file);
          thumbnailUrl = URL.createObjectURL(file);
        } else if (
          assetType === "RAW_VIDEO" ||
          assetType === "EDITED_VIDEO" ||
          assetType === "B_ROLL"
        ) {
          const videoMeta = await extractVideoMetadata(file);
          durationSeconds = videoMeta.durationSeconds;
          dimensions = videoMeta.dimensions;
          thumbnailUrl = videoMeta.thumbnailUrl;
        } else {
          scriptPreview = await extractScriptPreview(file);
        }

        const metadataInput: SaveMetadataInput = {
          deliverableId,
          assetType,
          fileName: file.name,
          filePath: signed.path,
          fileSizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          durationSeconds,
          dimensions,
        };

        await saveMetadata(metadataInput);

        setPreview({
          name: file.name,
          assetType,
          fileSizeBytes: file.size,
          thumbnailUrl,
          scriptPreview,
        });
        setProgress(100);
        onUploadSuccess?.(metadataInput);
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Upload failed. Please retry.";
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [assetType, deliverableId, getSignedUrl, maxSizeBytes, onUploadSuccess, saveMetadata],
  );

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    maxSize: maxSizeBytes,
    accept,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Upload Content File</p>
        <select
          value={assetType}
          onChange={(event) => setAssetType(event.target.value as MediaAssetType)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
          disabled={isUploading}
        >
          {ASSET_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-md border border-dashed p-6 text-center transition ${
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-gray-300 hover:border-gray-400 dark:border-gray-700"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop file here" : "Drag & drop a file, or click to choose"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max size: 100MB. Allowed types depend on selected asset.
        </p>
        <div className="mt-3">
          <Button type="button" variant="outline" size="sm" disabled={isUploading}>
            Choose File
          </Button>
        </div>
      </div>

      {isUploading ? (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900/60 dark:bg-green-900/20">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            Upload successful
          </p>
          <p className="text-xs text-green-700/90 dark:text-green-300/90">
            {preview.name} ({preview.assetType})
          </p>
          <p className="text-xs text-green-700/90 dark:text-green-300/90">
            Size: {getReadableSize(preview.fileSizeBytes)}
          </p>

          {preview.thumbnailUrl ? (
            <img
              src={preview.thumbnailUrl}
              alt="Uploaded file preview"
              className="mt-2 max-h-40 rounded-md border border-green-200 object-cover dark:border-green-900/60"
            />
          ) : null}

          {preview.scriptPreview ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-green-200 bg-white p-2 text-xs text-gray-700 dark:border-green-900/60 dark:bg-gray-950 dark:text-gray-200">
              {preview.scriptPreview}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
