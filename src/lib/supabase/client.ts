import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for the browser (used for direct file uploads to private
 * Storage buckets). Uses the signed-in user's session; RLS applies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
