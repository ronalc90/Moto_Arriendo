import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

function toLogin(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?error=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(url, { status: 303 });
}

/** Same check Next.js does for Server Actions: the form must come from this site. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // old browsers; the SameSite=Lax session cookie still applies
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** "Cerrar sesión" / "Salir" buttons: a form POST from the app's own pages. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Origen no permitido", { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  return toLogin(request, "salida");
}

/**
 * Pages redirect here when the signed-in account has no access (no profile, or
 * deactivated). A GET can come from any link or image on another site, so it
 * only signs out an account that really has no access: an active user is sent
 * back to the app and keeps their session.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return toLogin(request, request.nextUrl.searchParams.get("error") ?? "salida");

  const profile = await getProfile();
  if (profile?.active) return NextResponse.redirect(new URL("/", request.url), { status: 303 });

  await supabase.auth.signOut();
  return toLogin(request, profile ? "inactivo" : "sin-acceso");
}
