import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      {children}
    </div>
  );
}
