import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#3b82f6",
};

export const metadata: Metadata = {
  title: "VISTA SmartFlow AI — Dishub DKI Jakarta",
  description: "Sistem Pemantauan & Penegakan Hukum Lalu Lintas Berbasis AI untuk Dinas Perhubungan DKI Jakarta",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VISTA AI",
  },
  openGraph: {
    title: "VISTA SmartFlow AI",
    description: "ITS Platform untuk Dishub DKI Jakarta",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
