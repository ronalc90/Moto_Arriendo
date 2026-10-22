/**
 * Public Supabase settings. These two values are safe to expose to the
 * browser: every table is protected by Row Level Security.
 * The secret (service_role) key is intentionally NOT used anywhere in the app.
 */
export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

export function supabasePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return value;
}
