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
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Pelanggaran", href: "/violations", icon: ShieldAlert, badge: true },
  { name: "Peta Hotspot", href: "/heatmap", icon: MapIcon },
  { name: "CCTV Monitor", href: "/cameras", icon: Camera },
  { name: "Laporan", href: "/reports", icon: FileText },
  { name: "Pengaturan", href: "/settings", icon: Settings, adminOnly: true },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!isOpen) return null;

  const userRole = session?.user?.role || "VIEWER";

  return (
    <div className="relative z-50 lg:hidden">
      <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-bg-secondary p-6 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10">
              <div className="h-4 w-4 rounded-sm bg-accent-blue shadow-[var(--glow-blue)] animate-pulse-dot" />
            </div>
            <span className="font-heading text-xl font-bold text-white">SmartFlow AI</span>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            if (item.adminOnly && userRole !== "ADMIN") return null;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-accent-blue/10 text-accent-blue shadow-[inset_4px_0_0_0_var(--accent-blue)]"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
