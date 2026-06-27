import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/*
 * Typography roles:
 *  - Space Grotesk (display): technical but characterful headings.
 *  - Inter (body): highly legible UI text.
 *  - JetBrains Mono (utility): instrument readouts, labels, numeric data.
 * Each is exposed as a CSS variable consumed by Tailwind + globals.css.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThermRad — Molecular Stress Simulation",
  description:
    "Simulate extreme thermal and radiation stress on molecular structures, in the browser.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}
      >
        {/* z-10 keeps content above the fixed grid/vignette backdrop. */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
