import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk — VISTA SmartFlow AI",
  description:
    "Portal autentikasi VISTA SmartFlow AI — sistem pemantauan lalu lintas cerdas Dinas Perhubungan Provinsi DKI Jakarta.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
