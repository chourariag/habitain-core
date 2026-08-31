import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers for private storage buckets.
 *
 * Buckets like `site-photos` and `dry-run-videos` are PRIVATE, so
 * `getPublicUrl()` returns a link that 400s for anyone without an active
 * session cookie on the storage origin. We therefore persist the *object path*
 * and mint short-lived signed URLs at render time.
 */

/** Strip a legacy public/signed URL down to the bucket-relative object path. */
export function toObjectPath(bucket: string, value: string): string {
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return value;
    // .../object/{public|sign}/{bucket}/{path}
    let rest = url.pathname.slice(idx + marker.length);
    rest = rest.replace(/^(public|sign|authenticated)\//, "");
    if (rest.startsWith(`${bucket}/`)) rest = rest.slice(bucket.length + 1);
    return decodeURIComponent(rest);
  } catch {
    return value;
  }
}

/** Create a signed URL for a stored object path (or legacy full URL). */
export async function getSignedUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  if (!value) return null;
  const path = toObjectPath(bucket, value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Batch variant: returns a map of original value -> signed URL. */
export async function getSignedUrls(
  bucket: string,
  values: (string | null | undefined)[],
  expiresIn = 60 * 60,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = Array.from(new Set(values.filter(Boolean) as string[]));
  await Promise.all(
    unique.map(async (v) => {
      const signed = await getSignedUrl(bucket, v, expiresIn);
      if (signed) out[v] = signed;
    }),
  );
  return out;
}
