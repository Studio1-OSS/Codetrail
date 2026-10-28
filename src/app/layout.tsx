import type { Metadata, Viewport } from "next";
import { env } from "@/env";
import { Geist, Geist_Mono, Martian_Mono } from "next/font/google";
import { themeScript } from "@/components/theme-toggle";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian" });

const description =
  "Paste any GitHub repo. DeepSeek V4.1 Flash 1017 reads every file at once, draws the architecture, writes the docs and walks you through how the code runs, line by checked line.";

export const metadata: Metadata = {
  metadataBase: new URL(env.SITE_URL),
  title: { default: "Codetrail: understand any GitHub repo, line by checked line", template: "%s · Codetrail" },
  description,
  applicationName: "Codetrail",
  keywords: ["code tour", "codebase walkthrough", "architecture diagram", "AI code docs", "GitHub repo explorer", "DeepSeek", "DeepWiki alternative", "GitDiagram alternative", "CodeTour", "MCP"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Codetrail", url: "/", title: "Codetrail: diagram, wiki, code tour and Q&A, in one link", description },
  twitter: { card: "summary_large_image", title: "Codetrail: diagram, wiki, code tour and Q&A, in one link", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
    { media: "(prefers-color-scheme: light)", color: "#f4f0e6" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${martian.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only z-[100] rounded-md bg-trail px-3 py-2 font-mono text-sm text-[#16171a] focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
