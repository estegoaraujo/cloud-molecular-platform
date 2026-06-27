import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/app/auth/actions";

/**
 * /login — email + password sign-in.
 *
 * Reads one-time flags from the query string to show contextual notices:
 *  - checkEmail: arrived here right after signing up (confirmation required)
 *  - error=confirm: a confirmation link failed
 * Signed-in users never reach this page; middleware redirects them away.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ checkEmail?: string; error?: string }>;
}) {
  const params = await searchParams;

  let notice: string | null = null;
  if (params.checkEmail) {
    notice = "Account created. Check your email to confirm, then sign in.";
  } else if (params.error === "confirm") {
    notice = "That confirmation link was invalid or expired. Try signing in.";
  }

  return (
    <AuthShell
      eyebrow="// auth · secure channel"
      title="Sign in to the console"
      subtitle="Access your simulations and run new stress tests."
    >
      <AuthForm mode="login" action={login} notice={notice} />
    </AuthShell>
  );
}
