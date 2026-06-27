/**
 * Next.js middleware entry point.
 *
 * Runs on the Edge before matched routes. It delegates to `updateSession`,
 * which (1) refreshes the Supabase auth token and (2) enforces route guards.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /**
   * Run on all paths EXCEPT static assets and image optimization, which never
   * need a session refresh. The negative lookahead keeps middleware cheap.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
