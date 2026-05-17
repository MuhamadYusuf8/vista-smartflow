"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface AuditLog {
  id: string;
  event: string;
  details: Record<string, string>;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

const EVENT_STYLES: Record<string, string> = {
  VIOLATION_VERIFIED: "bg-accent-green/10 text-accent-green border-accent-green/20",
  VIOLATION_DISMISSED: "bg-border text-text-muted border-border",
  VIOLATION_EXPORTED: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  USER_LOGIN: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20",
  USER_LOGOUT: "bg-bg-tertiary text-text-muted border-border",
  CAMERA_UPDATED: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  SETTINGS_CHANGED: "bg-accent-amber/10 text-accent-amber border-accent-amber/20",
  BULK_EXPORT: "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
  DATA_SYNC_ETLE: "bg-accent-green/10 text-accent-green border-accent-green/20",
};

const EVENT_LABELS: Record<string, string> = {
  VIOLATION_VERIFIED: "Verifikasi Pelanggaran",
  VIOLATION_DISMISSED: "Tolak Pelanggaran",
  VIOLATION_EXPORTED: "Ekspor ke E-TLE",
  USER_LOGIN: "Login",
  USER_LOGOUT: "Logout",
  CAMERA_UPDATED: "Update Kamera",
  SETTINGS_CHANGED: "Ubah Pengaturan",
  BULK_EXPORT: "Ekspor Massal",
  DATA_SYNC_ETLE: "Sinkronisasi E-TLE",
};

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audit-log?page=${page}&limit=${PAGE_SIZE}`);
      if (res.status === 403) {
        setError("Akses ditolak. Halaman ini hanya dapat diakses oleh Admin.");
        return;
      }
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const userRole = session?.user?.role;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
            <Shield className="h-7 w-7 text-accent-blue" />
            Audit Log Sistem
          </h1>
          <p className="text-sm text-text-muted">
            Riwayat semua tindakan krusial yang dilakukan dalam sistem VISTA SmartFlow AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          {userRole !== "ADMIN" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-red/20 bg-accent-red/10 px-3 py-1.5 text-xs font-semibold text-accent-red">
              🔒 Admin Only
            </span>
          )}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-border disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/10 p-6 text-center">
          <Shield className="h-10 w-10 text-accent-red mx-auto mb-3 opacity-60" />
          <p className="font-semibold text-accent-red">{error}</p>
        </div>
      )}

      {/* Stats */}
      {!error && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Log", value: data.total.toLocaleString("id-ID"), color: "text-white" },
            {
              label: "Verifikasi",
              value: data.logs.filter((l) => l.event === "VIOLATION_VERIFIED").length,
              color: "text-accent-green",
            },
            {
              label: "Ditolak",
              value: data.logs.filter((l) => l.event === "VIOLATION_DISMISSED").length,
              color: "text-text-muted",
            },
            {
              label: "Ekspor E-TLE",
              value: data.logs.filter((l) => l.event === "VIOLATION_EXPORTED").length,
              color: "text-accent-blue",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border bg-bg-secondary p-4"
            >
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {item.label}
              </p>
              <p className={cn("text-2xl font-bold mt-1", item.color)}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Log Table */}
      {!error && (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-tertiary">
            <span className="text-sm font-semibold text-text-secondary">
              LOG AKTIVITAS {loading ? "(Memuat...)" : `(${data?.total ?? 0} entri)`}
            </span>
            <button className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors">
              <Download className="h-3.5 w-3.5" />
              Export Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-bg-primary text-text-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Waktu
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Pelaku
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-bg-tertiary animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.logs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-text-muted">
                      <Shield className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Belum ada log aktivitas</p>
                    </td>
                  </tr>
                ) : (
                  (data?.logs ?? []).map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-bg-tertiary/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-text-muted">
                        {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm:ss", {
                          locale: idLocale,
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            EVENT_STYLES[log.event] ??
                              "bg-bg-tertiary text-text-muted border-border"
                          )}
                        >
                          {EVENT_LABELS[log.event] ?? log.event}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {log.details.userEmail ?? log.details.userId ?? (
                          <span className="text-text-muted italic">System</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-text-muted">
                        {log.details.targetId
                          ? log.details.targetId.slice(0, 8).toUpperCase()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-text-secondary max-w-[300px] truncate" title={log.details.details}>
                        {log.details.details ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-bg-tertiary">
              <span className="text-sm text-text-muted">
                Halaman{" "}
                <span className="font-medium text-white">{data.page}</span> dari{" "}
                <span className="font-medium text-white">{data.totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-muted disabled:opacity-50 hover:bg-border hover:text-white transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= data.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-muted disabled:opacity-50 hover:bg-border hover:text-white transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
