import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { PREFERENCES_BOOT_SCRIPT } from "@/lib/preferences";
import "./globals.css";

const literata = localFont({
  src: [
    { path: "./fonts/Literata-Variable.woff2", style: "normal", weight: "200 900" },
    { path: "./fonts/Literata-Variable-Italic.woff2", style: "italic", weight: "200 900" },
  ],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "IELTS Practice Studio", template: "%s · IELTS Practice Studio" },
  description:
    "Practise IELTS Listening, Reading, Writing and Speaking with timed tasks, instant marking and examiner-style AI feedback.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4ecd8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1712" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The CSP nonce comes from proxy.ts; reading headers also renders every page per request, which nonces require.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} ${literata.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-lift"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
