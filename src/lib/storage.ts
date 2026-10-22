import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Bucket = "receipts" | "inspections" | "damages" | "documents" | "contracts";

/** Short-lived signed URLs (default 5 minutes). RLS on storage decides access. */
export async function signedUrl(bucket: Bucket, path: string | null | undefined, expiresIn = 300) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Many signed URLs at once, keyed by path. */
export async function signedUrls(bucket: Bucket, paths: Array<string | null | undefined>, expiresIn = 300) {
  const list = paths.filter((p): p is string => Boolean(p));
  const map = new Map<string, string>();
  if (!list.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(list, expiresIn);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

const SAFE_PATH = /^[a-zA-Z0-9/_.-]+$/;

/**
 * Server-side check that an uploaded file path belongs where we expect
 * (right folder, allowed extension) before we save it in the database.
 */
export function isValidUploadPath(path: string, prefix: string, extensions: string[]) {
  if (!path || path.length > 300 || !SAFE_PATH.test(path) || path.includes("..")) return false;
  if (!path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return extensions.includes(ext);
}

export const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];
export const DOC_EXT = [...IMAGE_EXT, "pdf"];
