import Link from "next/link";
import { AuthScene } from "./auth-scene";

/**
 * Split-screen frame for the auth pages: an ambient lattice viewport on the
 * left, the form panel on the right. Collapses to a single column on mobile,
 * where the viewport is hidden to keep the form front-and-center.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-5 py-10">
      <div className="grid w-full overflow-hidden rounded-2xl border border-line shadow-panel md:grid-cols-2">
        {/* Left: ambient viewport (desktop only). */}
        <aside className="relative hidden bg-panel md:block">
          {/* Thermal calibration bar — the signature ramp. */}
          <div className="spectral-ramp absolute inset-x-0 top-0 h-0.5" />
          <div className="absolute left-6 top-6 z-10">
            <Brand />
          </div>
          <div className="absolute inset-0">
            <AuthScene />
          </div>
          <div className="absolute bottom-6 left-6 right-6 z-10">
            <p className="mono-label">{"// thermal · radiation · destabilization"}</p>
            <p className="mt-1 text-sm text-muted">
              Upload a structure. Apply stress. Watch it come apart, frame by
              frame.
            </p>
          </div>
        </aside>

        {/* Right: form panel. */}
        <section className="relative bg-void px-6 py-10 sm:px-10">
          <div className="spectral-ramp absolute inset-x-0 top-0 h-0.5 md:hidden" />
          <div className="mb-8 md:hidden">
            <Brand />
          </div>

          <p className="mono-label">{eyebrow}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1 mb-7 text-sm text-muted">{subtitle}</p>

          {children}
        </section>
      </div>
    </main>
  );
}

/** Wordmark used in both panels. */
function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="spectral-ramp h-4 w-4 rounded-sm" />
      <span className="font-display text-sm font-semibold tracking-tight text-ink">
        ThermRad
      </span>
    </Link>
  );
}
