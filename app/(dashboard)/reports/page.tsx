"use client";

import { useState, useEffect } from "react";
import { Download, FileText, UploadCloud, Calendar as CalendarIcon, Server, Activity, RefreshCw, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { VehicleTypeChart } from "@/components/dashboard/VehicleTypeChart";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ReportStats {
  total: number;
  verified: number;
  exported: number;
  dismissed: number;
  pending: number;
  completionRate: number;
  vehicleData: { name: string; value: number; color: string }[];
  topViolationType: string;
}

interface EtleQueueItem {
  id: string;
  license_plate: string;
  type: string;
  timestamp: string;
  etle_ref: string | null;
}

const VEHICLE_COLORS: Record<string, string> = {
  CAR: "#3B82F6",
  MOTORCYCLE: "#10B981",
  BUS: "#F59E0B",
  TRUCK: "#EF4444",
  OTHER: "#8B5CF6",
};

const TYPE_LABELS: Record<string, string> = {
  ILLEGAL_PARKING: "Parkir Liar",
  BUSWAY_VIOLATION: "Jalur Busway",
  BICYCLE_LANE_VIOLATION: "Jalur Sepeda",
  BUS_STOP_VIOLATION: "Halte Bus",
  WRONG_LANE: "Salah Lajur",
};

// StatItem harus didefinisikan di luar komponen utama agar React tidak membuat komponen baru setiap render
function StatItem({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={cn("text-lg font-bold", colorClass ?? "text-white")}>{value}</span>
    </div>
  );
}

export default function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [etleQueue, setEtleQueue] = useState<EtleQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState<"csv" | "pdf" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [allRes, verifiedRes, exportedRes, dismissedRes, pendingRes, vehicleRes, etleRes] = await Promise.all([
          supabase.from("violations").select("id", { count: "exact", head: true }).gte("timestamp", monthStart.toISOString()),
          supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "VERIFIED").gte("timestamp", monthStart.toISOString()),
          supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "EXPORTED").gte("timestamp", monthStart.toISOString()),
          supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "DISMISSED").gte("timestamp", monthStart.toISOString()),
          supabase.from("violations").select("id", { count: "exact", head: true }).eq("status", "PENDING").gte("timestamp", monthStart.toISOString()),
          supabase.from("violations").select("vehicle_type").gte("timestamp", monthStart.toISOString()),
          supabase.from("violations")
            .select("id, license_plate, type, timestamp, etle_ref")
            .eq("status", "VERIFIED")
            .order("timestamp", { ascending: false })
            .limit(10),
        ]);

        const total = allRes.count ?? 0;
        const verified = verifiedRes.count ?? 0;
        const exported = exportedRes.count ?? 0;
        const dismissed = dismissedRes.count ?? 0;
        const pending = pendingRes.count ?? 0;
        const completionRate = total > 0 ? Math.round(((verified + exported) / total) * 100 * 10) / 10 : 0;

        // Vehicle distribution
        const vMap: Record<string, number> = {};
        (vehicleRes.data ?? []).forEach((v) => {
          vMap[v.vehicle_type] = (vMap[v.vehicle_type] ?? 0) + 1;
        });
        const vehicleData = Object.entries(vMap).map(([name, value]) => ({
          name,
          value,
          color: VEHICLE_COLORS[name] ?? "#64748B",
        }));

        // Top violation type this month
        const typeRes = await supabase.from("violations").select("type").gte("timestamp", monthStart.toISOString());
        const typeMap: Record<string, number> = {};
        (typeRes.data ?? []).forEach((v) => { typeMap[v.type] = (typeMap[v.type] ?? 0) + 1; });
        const topType = Object.entries(typeMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";

        setStats({ total, verified, exported, dismissed, pending, completionRate, vehicleData, topViolationType: topType });
        setEtleQueue(etleRes.data ?? []);
      } catch (err) {
        console.error("Report data error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportData();
  }, []);

  const handleExport = async (fmt: "csv" | "pdf") => {
    setExportLoading(fmt);
    try {
      const res = await fetch(`/api/export?format=${fmt}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `violations_export_${format(new Date(), "yyyyMMdd")}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExportLoading(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Simulate sync: mark all VERIFIED in queue as EXPORTED
      const ids = etleQueue.map((e) => e.id);
      if (ids.length > 0) {
        await supabase
          .from("violations")
          .update({
            status: "EXPORTED",
            processed_at: new Date().toISOString(),
            etle_ref: `ETLE-SYNC-${Date.now().toString(36).toUpperCase()}`,
          })
          .in("id", ids);
      }
      setSyncDone(true);
      setEtleQueue([]);
      setTimeout(() => setSyncDone(false), 4000);
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Laporan & Integrasi E-TLE
          </h1>
          <p className="text-sm text-text-muted">
            Summary statistik, export data, dan status integrasi sistem
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Left Column: Stats & System */}
        <div className="space-y-8 xl:col-span-1">
          {/* Section A: Stats Summary */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="font-heading text-lg font-bold text-white mb-4 border-b border-border pb-3 flex items-center justify-between">
              Ringkasan Bulan Ini
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <CalendarIcon className="h-4 w-4" />
                {format(new Date(), "MMM yyyy")}
              </span>
            </h2>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-bg-tertiary" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <StatItem label="Total Pelanggaran" value={(stats?.total ?? 0).toLocaleString("id-ID")} />
                <StatItem label="Terverifikasi" value={stats?.verified ?? 0} colorClass="text-accent-green" />
                <StatItem label="Terkirim E-TLE" value={stats?.exported ?? 0} colorClass="text-accent-blue" />
                <StatItem label="Ditolak" value={stats?.dismissed ?? 0} colorClass="text-text-muted" />
                <StatItem label="Menunggu" value={stats?.pending ?? 0} colorClass="text-accent-amber" />
                <StatItem
                  label="Tingkat Penyelesaian"
                  value={`${stats?.completionRate ?? 0}%`}
                  colorClass="text-accent-green"
                />
                {stats?.topViolationType && (
                  <StatItem
                    label="Pelanggaran Terbanyak"
                    value={TYPE_LABELS[stats.topViolationType] ?? stats.topViolationType}
                    colorClass="text-accent-red"
                  />
                )}
              </div>
            )}

            {!loading && stats && (
              <div className="mt-6 h-[250px]">
                <VehicleTypeChart data={stats.vehicleData} />
              </div>
            )}
          </section>

          {/* Section C: System Performance */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="font-heading text-lg font-bold text-white mb-4 border-b border-border pb-3 flex items-center justify-between">
              Status Sistem
              <span className="inline-flex items-center gap-1 rounded bg-accent-green/10 px-2 py-1 text-[10px] font-bold text-accent-green uppercase tracking-wider">
                <div className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
                Normal
              </span>
            </h2>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Activity className="h-4 w-4" /> Server E-TLE Uptime
                  </span>
                  <span className="font-mono text-white">99.98%</span>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green w-[99.98%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Server className="h-4 w-4" /> AI Node Usage
                  </span>
                  <span className="font-mono text-white">
                    {stats ? Math.round(((stats.exported + stats.verified) / Math.max(1, stats.total)) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue transition-all duration-1000"
                    style={{
                      width: `${stats ? Math.round(((stats.exported + stats.verified) / Math.max(1, stats.total)) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Export & ETLE */}
        <div className="xl:col-span-2 space-y-8">
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-border pb-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-white">Sinkronisasi E-TLE</h2>
                <p className="text-sm text-text-muted mt-1">
                  Ekspor data pelanggaran terverifikasi ke sistem tilang elektronik nasional
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center gap-2">
                {syncDone ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-green/10 border border-accent-green/20 px-3 py-1.5 text-xs font-semibold text-accent-green">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sync Berhasil
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5 text-xs font-semibold text-accent-blue">
                    Connected
                  </span>
                )}
              </div>
            </div>

            {/* E-TLE Queue Table */}
            <div className="rounded-lg border border-border overflow-hidden bg-bg-primary mb-6">
              <div className="bg-bg-tertiary px-4 py-2 border-b border-border flex justify-between items-center">
                <span className="text-xs font-semibold text-text-secondary">
                  ANTRIAN EKSPOR ({loading ? "..." : etleQueue.length} DATA TERVERIFIKASI)
                </span>
                <span className="text-xs font-medium text-text-muted">
                  {etleQueue.length > 0 ? "Siap dikirim" : "Antrian kosong"}
                </span>
              </div>
              <div className="p-0">
                {loading ? (
                  <div className="p-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-10 mb-2 rounded-lg bg-bg-tertiary animate-pulse" />
                    ))}
                  </div>
                ) : etleQueue.length === 0 ? (
                  <div className="py-12 text-center text-sm text-text-muted">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p>Semua data terverifikasi telah diekspor</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <tbody className="divide-y divide-border">
                      {etleQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-bg-tertiary/30">
                          <td className="px-4 py-3 font-mono text-xs text-text-muted">
                            {item.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">
                            {item.license_plate}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-accent-red/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-accent-red">
                              {TYPE_LABELS[item.type] ?? item.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-text-muted">
                              {format(new Date(item.timestamp), "dd MMM, HH:mm", { locale: idLocale })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSync}
                disabled={syncing || etleQueue.length === 0 || loading}
                className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
                {syncing ? "Sinkronisasi..." : "Sync ke Pusat Data E-TLE"}
              </button>
              <div className="flex flex-1 gap-3">
                <button
                  onClick={() => handleExport("csv")}
                  disabled={exportLoading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-border disabled:opacity-50"
                >
                  {exportLoading === "csv" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Unduh CSV
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exportLoading !== null}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-accent-red hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red transition-all disabled:opacity-50"
                >
                  {exportLoading === "pdf" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Cetak PDF
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
