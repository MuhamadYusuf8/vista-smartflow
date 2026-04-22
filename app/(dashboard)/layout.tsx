import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex flex-1 flex-col md:pl-72">
        <Header />
        <main className="flex-1 overflow-y-auto bg-bg-primary p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
