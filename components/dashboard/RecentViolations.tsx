"use client";

import { useSyncExternalStore } from "react";
import { Violation } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface RecentViolationsProps {
  violations: Violation[];
}

// Hydration-safe subscription using useSyncExternalStore
// This is the React-recommended pattern for client-only rendering
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}
function getSnapshot() { return true; }
function getServerSnapshot() { return false; }

export function RecentViolations({ violations }: RecentViolationsProps) {
  // useSyncExternalStore avoids the setState-in-effect lint error
  // Returns false on server, true on client — safe for hydration
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-xl border border-border bg-bg-secondary overflow-hidden">
      <div className="border-b border-border bg-bg-secondary/50 px-6 py-4 flex items-center justify-between">
        <h3 className="font-heading font-semibold text-white">Deteksi Terbaru</h3>
        <Link
          href="/violations"
          className="text-xs font-medium text-accent-blue hover:text-blue-400 transition-colors"
        >
          Lihat Semua
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {violations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-muted">
            Tidak ada data pelanggaran terbaru.
          </div>
        ) : (
          <div className="space-y-2">
            {violations.map((violation, i) => (
              <motion.div
                key={violation.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Link
                  href={`/violations/${violation.id}`}
                  className="group flex flex-col gap-3 rounded-lg border border-transparent p-4 transition-all hover:bg-bg-tertiary hover:border-border cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-accent-blue transition-colors rounded-l-lg" />

                  <div className="flex items-start justify-between">
                    <LicensePlate
                      plate={violation.licensePlate}
                      size="sm"
                      type={violation.vehicleType === "CAR" ? "car" : "motorcycle"}
                    />
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span>
                        {mounted
                          ? formatDistanceToNow(new Date(violation.timestamp), { addSuffix: true, locale: id })
                          : "..."
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-col gap-1.5 flex-1 pr-4">
                      <StatusBadge type="violationType" value={violation.type} className="w-fit" />
                      <div className="text-xs text-text-muted truncate max-w-[200px]" title={violation.location}>
                        {violation.location}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge type="violationStatus" value={violation.status} />

                      {violation.duration && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-mono",
                          violation.duration > 300 ? "text-accent-red font-bold animate-pulse" : "text-text-secondary"
                        )}>
                          <Timer className="h-3 w-3" />
                          {Math.floor(violation.duration / 60)}:{(violation.duration % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  </div>

                  <ConfidenceBar confidence={violation.confidence} showLabel={false} className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
