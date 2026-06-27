"use client";

/**
 * Shared email/password form for both login and signup.
 *
 * Uses React 19's `useActionState` to call a server action, surface its typed
 * error result inline, and expose a pending state for the submit button — all
 * without client-side fetch plumbing.
 */
import { useActionState } from "react";
import Link from "next/link";
import type { AuthResult } from "@/app/auth/actions";

type Mode = "login" | "signup";

type Props = {
  mode: Mode;
  /** Server action invoked on submit. */
  action: (formData: FormData) => Promise<AuthResult>;
  /** Optional banner (e.g. "check your email") shown above the form. */
  notice?: string | null;
};

const COPY: Record<Mode, { cta: string; pending: string; alt: string; altHref: string; altLabel: string }> = {
  login: {
    cta: "Enter console",
    pending: "Authenticating…",
    alt: "Need an account?",
    altHref: "/signup",
    altLabel: "Request access",
  },
  signup: {
    cta: "Create account",
    pending: "Provisioning…",
    alt: "Already enrolled?",
    altHref: "/login",
    altLabel: "Sign in",
  },
};

export function AuthForm({ mode, action, notice }: Props) {
  const copy = COPY[mode];

  // Adapt the (formData) action to the (prevState, formData) shape useActionState expects.
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(
    async (_prev, formData) => action(formData),
    undefined,
  );

  const error = state && "error" in state ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-cold/40 bg-cold/10 px-3 py-2 text-sm text-ink"
        >
          {notice}
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="mono-label">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="researcher@lab.org"
          className="field"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="mono-label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
          placeholder="••••••••"
          className="field"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-hot">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary mt-1">
        {pending ? copy.pending : copy.cta}
      </button>

      <p className="text-sm text-muted">
        {copy.alt}{" "}
        <Link href={copy.altHref} className="text-cold hover:underline">
          {copy.altLabel}
        </Link>
      </p>
    </form>
  );
}
