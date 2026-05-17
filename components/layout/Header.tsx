"use client";

import { useSession } from "next-auth/react";
import { Bell, Menu, Search } from "lucide-react";
import { MobileNav } from "./MobileNav";
import { useState } from "react";

export function Header() {
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-bg-secondary/80 px-4 shadow-sm backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-8">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-text-muted hover:text-white transition-colors lg:hidden"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Separator */}
        <div className="h-6 w-px bg-border lg:hidden" aria-hidden="true" />

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <form className="relative flex flex-1" action="#" method="GET">
            <label htmlFor="search-field" className="sr-only">
              Cari Pelat Nomor atau Lokasi
            </label>
            <Search
              className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-text-muted"
              aria-hidden="true"
            />
            <input
              id="search-field"
              className="block h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-white placeholder:text-text-muted focus:ring-0 sm:text-sm"
              placeholder="Cari Plat Nomor (ex: B 1234 CD)..."
              type="search"
              name="search"
            />
          </form>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <button
              type="button"
              className="relative -m-2.5 p-2.5 text-text-muted hover:text-white transition-colors"
            >
              <span className="sr-only">View notifications</span>
              <Bell className="h-6 w-6" aria-hidden="true" />
              <span className="absolute top-2 right-2.5 block h-2 w-2 rounded-full bg-accent-red ring-2 ring-bg-secondary" />
            </button>

            {/* Separator */}
            <div
              className="hidden lg:block lg:h-6 lg:w-px lg:bg-border"
              aria-hidden="true"
            />

            <div className="flex items-center gap-x-4">
              <span className="hidden lg:flex lg:items-center">
                <span
                  className="ml-4 text-sm font-semibold leading-6 text-white"
                  aria-hidden="true"
                >
                  {session?.user?.name || "Loading..."}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>
      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
}
