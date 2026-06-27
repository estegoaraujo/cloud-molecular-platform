"use server";

/**
 * Authentication server actions (email + password).
 *
 * These run only on the server, so they can use the cookie-bound Supabase
 * client and never expose credentials to the browser. Each action returns a
 * typed result the client form can render, or redirects on success.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Shape returned to the client form when something goes wrong. */
export type AuthResult = { error: string } | void;

/** Minimal email/password sanity checks shared by login + signup. */
function validate(email: string, password: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address.";
  }
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

/** Sign an existing user in, then send them to the dashboard. */
export async function login(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const invalid = validate(email, password);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Keep the message generic to avoid leaking which field was wrong.
    return { error: "Invalid email or password." };
  }

  // Re-render the app with the new authenticated session, then redirect.
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Register a new user. Depending on project settings, may require email
 *  confirmation before the session becomes active. */
export async function signup(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const invalid = validate(email, password);
  if (invalid) return { error: invalid };

  const supabase = await createClient();

  // Build an absolute callback URL for the confirmation email link.
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is required, Supabase returns a user but no session.
  if (data.user && !data.session) {
    redirect("/login?checkEmail=1");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Sign the current user out and return them to the login screen. */
export async function signout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
