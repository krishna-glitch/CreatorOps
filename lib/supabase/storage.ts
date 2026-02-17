import { createClient } from "@/lib/supabase/client";

const CREATOR_CONTENT_BUCKET = "creator-content";
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

export type UploadFileResult = {
  bucket: string;
  path: string;
  fileName: string;
  signedUrl: string;
};

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

function createUniqueFileName(fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const dotIndex = safeName.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < safeName.length - 1;
  const baseName = hasExtension ? safeName.slice(0, dotIndex) : safeName;
  const extension = hasExtension ? safeName.slice(dotIndex) : "";
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;

  return `${baseName || "file"}-${uniqueSuffix}${extension}`;
}

export async function getFileUrl(
  path: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
) {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(CREATOR_CONTENT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }

  return data.signedUrl;
}

export async function uploadFile(
  file: File,
  deliverableId: string,
): Promise<UploadFileResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(
      userError?.message ?? "You must be signed in to upload files",
    );
  }

  const uniqueFileName = createUniqueFileName(file.name);
  const path = `${user.id}/${deliverableId}/${uniqueFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(CREATOR_CONTENT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const signedUrl = await getFileUrl(path);

  return {
    bucket: CREATOR_CONTENT_BUCKET,
    path,
    fileName: uniqueFileName,
    signedUrl,
  };
}

export async function deleteFile(path: string) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(CREATOR_CONTENT_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}
