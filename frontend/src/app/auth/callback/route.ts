/**
 * Email-confirmation callback.
 *
 * When a user clicks the confirmation link in their signup email, Supabase
 * redirects here with a one-time `code`. We exchange it for a session (which
 * sets the auth cookies via the SSR client), then forward the user onward.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Allow callers to specify where to land after confirmation; default to app.
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — send them back to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
