/**
 * Session-refresh + route-guard helper for Next.js middleware.
 *
 * Supabase access tokens are short-lived. Because Server Components cannot write
 * cookies, we refresh the session here, in middleware, on every request — this
 * keeps the auth token fresh for the whole app and writes the rotated cookies
 * onto the outgoing response.
 *
 * We also centralize access control: unauthenticated users are redirected away
 * from protected routes, and already-authenticated users are bounced off the
 * auth pages.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** One cookie the SSR client asks us to persist. */
type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Route prefixes that require an authenticated user. */
const PROTECTED_PREFIXES = ["/dashboard"];

/** Auth routes that a signed-in user should be redirected away from. */
const AUTH_ROUTES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  // Start with a pass-through response we can attach refreshed cookies to.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Write rotated tokens to BOTH the request (so downstream reads see
          // them) and the response (so the browser stores them).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // `getUser()` validates the token with the Supabase Auth server (unlike
  // `getSession()`, which trusts the cookie). Do not run logic between client
  // creation and this call, per Supabase SSR guidance.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Gate 1: block anonymous access to protected areas.
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so we can return them after login.
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  // Gate 2: keep signed-in users out of login/signup.
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
