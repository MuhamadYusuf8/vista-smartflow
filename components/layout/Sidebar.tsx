"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  ShieldAlert,
  Map as MapIcon,
  Camera,
  FileText,
  Settings,
  LogOut,
  Shield,
  Activity,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Pelanggaran", href: "/violations", icon: ShieldAlert, badge: true },
  { name: "Peta Hotspot", href: "/heatmap", icon: MapIcon },
  { name: "Peta Lalu Lintas", href: "/peta", icon: Activity },
  { name: "CCTV Monitor", href: "/cameras", icon: Camera },
  { name: "Laporan", href: "/reports", icon: FileText },
  { name: "Audit Log", href: "/audit-log", icon: Shield, adminOnly: true },
  { name: "Pengaturan", href: "/settings", icon: Settings, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const userRole = session?.user?.role || "VIEWER";
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 flex-col border-r border-border bg-bg-secondary hidden md:flex">
      {/* Logo Area */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10">
            <div className="h-4 w-4 rounded-sm bg-accent-blue shadow-[var(--glow-blue)] animate-pulse-dot" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-white">SmartFlow AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && userRole !== "ADMIN") return null;
          
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-accent-blue/10 text-accent-blue shadow-[inset_4px_0_0_0_var(--accent-blue)]"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    isActive ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </div>
              {item.badge && (
                <span className="inline-flex items-center rounded-full bg-accent-red/10 px-2 py-0.5 text-xs font-medium text-accent-red ring-1 ring-inset ring-accent-red/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-red mr-1 animate-pulse" />
                  Live
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-bg-tertiary">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bg-tertiary border border-border">
            <span className="text-sm font-medium text-white">
              {session?.user?.name?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex flex-1 flex-col truncate">
            <span className="truncate text-sm font-medium text-white">
              {session?.user?.name || "Loading..."}
            </span>
            <span className="truncate text-xs text-text-muted">
              {userRole}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-text-muted hover:text-accent-red transition-colors rounded-md"
            title="Keluar"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
