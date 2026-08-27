import type { Metadata, Viewport } from "next";
// Self-hosted Inter (bundled — no runtime/network fetch, offline-build safe).
import "@fontsource-variable/inter";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/ui";

// `--font-sans` is what tailwind.config maps `font-sans` onto.
const fontStack =
  '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const metadata: Metadata = {
  title: {
    default: "PBX Console",
    template: "%s · PBX Console",
  },
  description: "Cloud PBX administration and agent console",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7f9",
};

// Applied before paint so the stored/system theme is set with no flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('pbx-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ ["--font-sans" as string]: fontStack }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
