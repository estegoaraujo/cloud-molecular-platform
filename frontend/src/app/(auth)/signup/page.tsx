import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { signup } from "@/app/auth/actions";

/**
 * /signup — create a new account with email + password.
 *
 * On success the user is either signed straight in (if email confirmation is
 * disabled) or routed to /login?checkEmail=1 (if confirmation is required).
 * Both paths are handled inside the `signup` server action.
 */
export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="// auth · request access"
      title="Create your account"
      subtitle="Spin up a workspace for molecular stress simulations."
    >
      <AuthForm mode="signup" action={signup} />
    </AuthShell>
  );
}
