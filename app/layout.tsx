import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { PWAClient } from "@/components/pwa-client";
import { ClientObservability } from "@/components/client-observability";
import { TRPCProvider } from "@/lib/trpc/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CreatorOps OS - Deal Tracking for Content Creators",
  description: "Manage and track your content creator deals efficiently",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CreatorOps",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var savedTheme = localStorage.getItem("creatorops-theme");
                  var supportsMatchMedia = typeof window.matchMedia === "function";
                  var prefersDark = supportsMatchMedia
                    ? window.matchMedia("(prefers-color-scheme: dark)").matches
                    : true;
                  var themePreference = "system";
                  var resolvedTheme = prefersDark ? "dark" : "light";

                  if (savedTheme === "light" || savedTheme === "dark") {
                    themePreference = savedTheme;
                    resolvedTheme = savedTheme;
                  } else {
                    try {
                      localStorage.setItem("creatorops-theme", "system");
                    } catch (_) {}
                  }

                  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
                  document.documentElement.setAttribute("data-theme", themePreference);
                  document.documentElement.style.colorScheme = resolvedTheme;
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${plusJakarta.variable} antialiased font-sans`}>
        <TRPCProvider>
          {children}
          <ClientObservability />
          <PWAClient />
          <div className="z-[var(--z-toast)] relative">
            <Toaster duration={3000} richColors />
          </div>
        </TRPCProvider>
      </body>
    </html>
  );
}
