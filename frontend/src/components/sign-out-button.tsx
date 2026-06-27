"use client";

/**
 * Sign-out control. Wraps the `signout` server action in a form so the click
 * runs server-side (clearing the auth cookies) and then redirects to /login.
 */
import { useTransition } from "react";
import { signout } from "@/app/auth/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <form action={() => startTransition(() => signout())}>
      <button type="submit" disabled={pending} className="btn-ghost">
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
