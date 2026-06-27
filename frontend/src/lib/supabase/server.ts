/**
 * Server Supabase client.
 *
 * Used by Server Components, Server Actions, and Route Handlers. It bridges
 * Supabase's auth layer to Next.js's cookie store so the user's session is read
 * (and refreshed) on the server.
 *
 * IMPORTANT: A fresh client must be created per request — never share a module-
 * level instance across requests, or you risk leaking one user's session to
 * another. `cookies()` is request-scoped, which enforces this for us.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** One cookie the SSR client asks us to persist. */
type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read every cookie so Supabase can locate the auth token.
        getAll() {
          return cookieStore.getAll();
        },
        // Persist refreshed tokens back to the response. In some contexts
        // (e.g. pure Server Components) writing cookies is not allowed and
        // throws; that's safe to ignore because the middleware refreshes the
        // session on the next request.
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component without a writable cookie store.
          }
        },
      },
    },
  );
}
