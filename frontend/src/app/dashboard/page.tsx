import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";
import { SimulationConsole } from "@/components/simulation/simulation-console";

/**
 * /dashboard — the protected console.
 *
 * Middleware already blocks anonymous access, but we re-verify here with
 * `getUser()` as defense-in-depth (never trust a single gate for auth). This
 * server component is the auth gate + chrome; the interactive Step 3 flow
 * (upload → run → animate) lives in the client <SimulationConsole/>.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-line bg-void/80 backdrop-blur">
        <div className="spectral-ramp h-0.5 w-full" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="spectral-ramp h-4 w-4 rounded-sm" />
            <span className="font-display text-sm font-semibold tracking-tight">
              ThermRad
            </span>
            <span className="mono-label ml-3 hidden sm:inline">{"// console"}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-muted sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="mono-label">{"// session active"}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as{" "}
          <span className="font-mono text-ink">{user.email}</span>.
        </p>

        {/* Step 3: the interactive upload → run → animate flow. */}
        <SimulationConsole />
      </main>
    </div>
  );
}
