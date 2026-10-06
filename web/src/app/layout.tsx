import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { AiProvider } from "@/components/ai/ai-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE } from "@/lib/site";

import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | COMP90024 MPI on Spartan`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: "Sunchuangyu (Rin) Huang" }, { name: "Wei Zhao" }],
  keywords: [
    "MPI",
    "mpi4py",
    "HPC",
    "Spartan",
    "Amdahl's law",
    "bootstrap confidence intervals",
    "LLM evaluation",
    "Web Workers",
    "COMP90024",
    "Twitter analytics",
  ],
  openGraph: {
    type: "website",
    title: SITE.name,
    description: SITE.description,
    siteName: SITE.name,
    locale: "en_AU",
  },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en-AU"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={150}>
            <AiProvider>
              <div
                aria-hidden
                className="bg-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]"
              />
              <SiteHeader />
              <main id="main" className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </AiProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
