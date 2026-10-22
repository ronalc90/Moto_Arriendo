import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Signs the user out and returns to the login page (optionally with a reason). */
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get("error") ?? "salida";
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?error=${encodeURIComponent(reason)}`;
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
