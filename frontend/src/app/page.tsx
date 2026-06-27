import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing page.
 *
 * Authenticated users are sent straight to the console; everyone else sees a
 * brief hero with sign-in / sign-up entry points. Kept intentionally small —
 * the product's real surface is the dashboard.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="spectral-ramp mb-6 h-1 w-24 rounded-full" />
      <p className="mono-label">{"// molecular stress simulation"}</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Heat it. Irradiate it.
        <br />
        Watch it come apart.
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted">
        Upload a molecular structure, apply extreme thermal and radiation
        stress on the backend, and replay the destabilization in your browser —
        frame by frame.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn-primary">
          Request access
        </Link>
        <Link href="/login" className="btn-ghost">
          Sign in
        </Link>
      </div>
    </main>
  );
}
