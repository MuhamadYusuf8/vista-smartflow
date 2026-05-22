"use client";

import { useSession } from "next-auth/react";
import { Bell, Menu, Search, Activity } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "SA";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-bg-secondary/80 px-4 backdrop-blur-md sm:gap-x-6 lg:px-8" style={{ boxShadow: "0 1px 0 rgba(30,45,77,0.8), 0 4px 24px rgba(0,0,0,0.3)" }}>

        {/* Mobile menu button */}
        <button
          type="button"
          className="-m-2.5 p-2.5 text-text-muted hover:text-white transition-colors lg:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Separator */}
        <div className="h-5 w-px bg-border lg:hidden" aria-hidden="true" />

        <div className="flex flex-1 items-center gap-x-4 self-stretch lg:gap-x-6">

          {/* Search bar */}
          <form className="relative flex flex-1 items-center max-w-md" action="#" method="GET">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" aria-hidden="true" />
            <input
              id="search-field"
              className="block h-9 w-full rounded-lg border border-border bg-bg-primary/60 py-0 pl-9 pr-3 text-sm text-white placeholder:text-text-muted focus:border-accent-blue/50 focus:bg-bg-primary focus:outline-none focus:ring-1 focus:ring-accent-blue/30 transition-all"
              placeholder="Cari Plat Nomor (ex: B 1234 CD)…"
              type="search"
              name="search"
            />
          </form>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-x-3 lg:gap-x-4">

            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1.5">
              <Activity className="h-3.5 w-3.5 text-accent-green animate-pulse" />
              <span className="text-[11px] font-semibold text-accent-green tracking-wide">LIVE</span>
            </div>

            {/* Notification bell */}
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-tertiary text-text-muted transition-all hover:border-border/70 hover:text-white"
            >
              <span className="sr-only">View notifications</span>
              <Bell className="h-4 w-4" aria-hidden="true" />
              {/* Red dot */}
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-red text-[8px] font-bold text-white ring-2 ring-bg-secondary">
                2
              </span>
            </button>

            {/* Separator */}
            <div className="hidden lg:block h-6 w-px bg-border" aria-hidden="true" />

            {/* User avatar + name */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-cyan text-xs font-bold text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]">
                {initials}
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold text-white">
                  {session?.user?.name || "System Admin"}
                </span>
                <span className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
                  {(session?.user as { role?: string })?.role || "ADMIN"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
}
