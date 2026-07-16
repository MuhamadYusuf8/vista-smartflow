import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (session) {
    redirect("/"); // dashboard utama sudah handle proteksi route
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
