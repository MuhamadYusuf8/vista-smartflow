"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home, ShieldAlert, Map as MapIcon, Camera, FileText,
  Settings, LogOut, Shield, Activity, Car, DollarSign,
  Navigation, Route, Users, MonitorPlay, TriangleAlert,
  Radio, Leaf, Database, Zap, Globe,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { name: "Dashboard", href: "/", icon: Home, group: "Utama" },
  { name: "Pelanggaran", href: "/violations", icon: ShieldAlert, badge: true, group: "Utama" },
  { name: "Peta Hotspot", href: "/heatmap", icon: MapIcon, group: "Utama" },
  { name: "Peta Lalu Lintas", href: "/peta", icon: Activity, group: "Utama" },
  { name: "CCTV Monitor", href: "/cameras", icon: Camera, group: "Utama" },

  // Pilot Project (Fase 1)
  { name: "Executive View", href: "/executive", icon: MonitorPlay, group: "Pilot Koridor" },
  { name: "Prediksi Kecelakaan", href: "/accident-prediction", icon: TriangleAlert, group: "Pilot Koridor" },

  // Smart City Features
  { name: "Command Center", href: "/command-center", icon: Radio, group: "Smart City" },
  { name: "ANPR Nasional", href: "/anpr-national", icon: Database, group: "Smart City" },
  { name: "Carbon Tracker", href: "/carbon-tracker", icon: Leaf, group: "Smart City" },
  { name: "Adaptive Traffic", href: "/adaptive-traffic", icon: Zap, group: "Smart City" },

  // Jakarta Policies
  { name: "Ganjil Genap", href: "/ganjil-genap", icon: Car, group: "Kebijakan Jakarta" },
  { name: "ERP / Tarif Jalan", href: "/erp", icon: DollarSign, group: "Kebijakan Jakarta" },

  // Integrasi Warga
  { name: "Laporan Warga (JAKI)", href: "/citizen-report", icon: Users, group: "Integrasi Warga" },

  // AI Analytics
  { name: "Prediksi Kemacetan", href: "/traffic-forecast", icon: Navigation, group: "AI Analytics" },
  { name: "Lacak Kendaraan", href: "/vehicle-tracking", icon: Route, group: "AI Analytics" },

  // Admin
  { name: "Laporan", href: "/reports", icon: FileText, group: "Admin" },
  { name: "Audit Log", href: "/audit-log", icon: Shield, adminOnly: true, group: "Admin" },
  { name: "Pengaturan", href: "/settings", icon: Settings, adminOnly: true, group: "Admin" },

  // Expansion
  { name: "Expansion Hub", href: "/expansion-hub", icon: Globe, group: "Ekspansi Global" },
];

const GROUP_ORDER = ["Utama", "Pilot Koridor", "Smart City", "Kebijakan Jakarta", "Integrasi Warga", "AI Analytics", "Admin", "Ekspansi Global"];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pendingCount, setPendingCount] = useState(0);

  const userRole = session?.user?.role || "VIEWER";

  // Fetch live pending violations count
  useEffect(() => {
    async function fetchPending() {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count } = await sb
          .from("violations")
          .select("*", { count: "exact", head: true })
          .eq("status", "PENDING")
          .gte("created_at", today.toISOString());
        if (count !== null) setPendingCount(count);
      } catch { /* silent */ }
    }
    fetchPending();
    const interval = setInterval(fetchPending, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 flex-col border-r border-border bg-bg-secondary hidden md:flex">
      {/* Logo Area */}
      <div className="flex h-16 items-center px-6 border-b border-border relative">
        {/* Subtle accent top line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, #3B82F6 0%, #06B6D4 50%, transparent 100%)" }}
        />
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <div className="h-4 w-4 rounded-sm bg-accent-blue shadow-[var(--glow-blue)] animate-pulse-dot" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-white">SmartFlow AI</span>
        </div>
      </div>

      {/* Navigation — premium thin scrollbar */}
      <nav
        className="flex-1 px-3 py-4 overflow-y-auto space-y-4"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#1E3A5F #0F1628" }}
      >
        {GROUP_ORDER.map((group) => {
          const items = navItems.filter((item) => item.group === group);
          const visibleItems = items.filter((item) => !item.adminOnly || userRole === "ADMIN");
          if (visibleItems.length === 0) return null;

          const GROUP_COLORS: Record<string, string> = {
            "Pilot Koridor": "text-accent-green",
            "Smart City": "text-purple-400",
            "Kebijakan Jakarta": "text-accent-amber",
            "Integrasi Warga": "text-accent-cyan",
            "AI Analytics": "text-accent-blue",
            "Admin": "text-text-muted",
            "Ekspansi Global": "text-accent-blue",
          };

          return (
            <div key={group}>
              {group !== "Utama" && (
                <p className={cn(
                  "px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest",
                  GROUP_COLORS[group] ?? "text-text-muted"
                )}>
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
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
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"
                          )}
                          aria-hidden="true"
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                      {"badge" in item && item.badge && (
                        <span className="inline-flex items-center rounded-full bg-accent-red/10 px-2 py-0.5 text-xs font-medium text-accent-red ring-1 ring-inset ring-accent-red/20">
                          {pendingCount > 0 ? (
                            <span className="font-bold">{pendingCount > 99 ? "99+" : pendingCount}</span>
                          ) : (
                            <><div className="w-1.5 h-1.5 rounded-full bg-accent-red mr-1 animate-pulse" />Live</>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
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
