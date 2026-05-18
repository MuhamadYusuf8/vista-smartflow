"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, Car, MapPin, RefreshCw,
  BarChart2, Zap, Navigation,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

interface ERPSummary {
  totalVehiclesToday: number;
  totalRevenueTodayRp: number;
  projectedMonthlyRp: number;
  projectedYearlyRp: number;
  growthVsLastWeek: number;
  activeZones: number;
  violationsCorrelated: number;
}

interface ERPZone {
  id: string;
  name: string;
  stretch: string;
  lat: number;
  lng: number;
  tariff: number;
  color: string;
  stats: {
    vehiclesPassed: number;
    taxableVehicles: number;
    exemptVehicles: number;
    revenue: number;
    avgSpeedKmh: number;
    congestionLevel: string;
  };
}

interface ERPData {
  summary: ERPSummary;
  zones: ERPZone[];
  historicalData: Array<{ date: string; revenue: number; vehicles: number }>;
}

function formatRupiah(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const CONGESTION_COLORS: Record<string, string> = {
  RENDAH: "text-accent-green",
  SEDANG: "text-accent-amber",
  TINGGI: "text-accent-red",
};

export default function ERPPage() {
  const [data, setData] = useState<ERPData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
            <DollarSign className="h-7 w-7 text-accent-green" />
            Electronic Road Pricing (ERP)
          </h1>
          <p className="text-sm text-text-muted">
            Pemantauan potensi Pendapatan Asli Daerah (PAD) dari tarif jalan raya Jakarta
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm font-medium text-white hover:bg-border"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Pendapatan Hari Ini",
            value: summary ? formatRupiah(summary.totalRevenueTodayRp) : "—",
            sub: `${summary?.totalVehiclesToday.toLocaleString("id-ID") ?? "—"} kendaraan`,
            icon: DollarSign,
            color: "text-accent-green",
            glow: "bg-accent-green/10 border-accent-green/20",
          },
          {
            label: "Proyeksi Bulanan",
            value: summary ? formatRupiah(summary.projectedMonthlyRp) : "—",
            sub: "22 hari kerja",
            icon: TrendingUp,
            color: "text-accent-blue",
            glow: "bg-accent-blue/10 border-accent-blue/20",
          },
          {
            label: "Proyeksi Tahunan",
            value: summary ? formatRupiah(summary.projectedYearlyRp) : "—",
            sub: "Estimasi PAD ERP",
            icon: BarChart2,
            color: "text-accent-amber",
            glow: "bg-accent-amber/10 border-accent-amber/20",
          },
          {
            label: "Pertumbuhan",
            value: summary ? `+${summary.growthVsLastWeek}%` : "—",
            sub: "vs minggu lalu",
            icon: Zap,
            color: "text-accent-cyan",
            glow: "bg-accent-cyan/10 border-accent-cyan/20",
          },
        ].map((item) => (
          <div key={item.label} className={cn("rounded-xl border p-5", item.glow)}>
            <div className="flex items-center gap-2 mb-3">
              <item.icon className={cn("h-4 w-4", item.color)} />
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{item.label}</p>
            </div>
            <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
            <p className="text-xs text-text-muted mt-1">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-border bg-bg-secondary p-6">
        <h2 className="font-heading text-lg font-bold text-white mb-1">Tren Pendapatan ERP (7 Hari)</h2>
        <p className="text-xs text-text-muted mb-5">Pendapatan aktual vs proyeksi harian</p>
        {loading ? (
          <div className="h-[220px] animate-pulse bg-bg-tertiary rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.historicalData ?? []}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}Jt`} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [formatRupiah(Number(v ?? 0)), "Pendapatan"]}
                contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8 }}
                labelStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(data?.zones ?? []).map((zone) => (
          <div key={zone.id} className="rounded-xl border border-border bg-bg-secondary p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: zone.color }} />
                  <h3 className="font-semibold text-white text-sm">{zone.name}</h3>
                </div>
                <p className="text-xs text-text-muted">{zone.stretch}</p>
              </div>
              <span className={cn("text-xs font-bold", CONGESTION_COLORS[zone.stats.congestionLevel] ?? "text-text-muted")}>
                {zone.stats.congestionLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Kendaraan", value: zone.stats.vehiclesPassed.toLocaleString("id-ID") },
                { label: "Kena Tarif", value: zone.stats.taxableVehicles.toLocaleString("id-ID") },
                { label: "Tarif / Kend.", value: `Rp ${zone.tariff.toLocaleString("id-ID")}` },
                { label: "Kec. Rata-rata", value: `${zone.stats.avgSpeedKmh} km/h` },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs text-text-muted">{item.label}</p>
                  <p className="text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-accent-green/10 border border-accent-green/20 p-3 text-center">
              <p className="text-xs text-text-muted mb-0.5">Pendapatan Zona</p>
              <p className="text-lg font-bold text-accent-green">{formatRupiah(zone.stats.revenue)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Vehicle Volume Bar */}
      <div className="rounded-xl border border-border bg-bg-secondary p-6">
        <h2 className="font-heading text-lg font-bold text-white mb-5">
          Volume Kendaraan per Zona (Hari Ini)
        </h2>
        {loading ? (
          <div className="h-[180px] animate-pulse bg-bg-tertiary rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.zones.map(z => ({ name: z.name.replace("Koridor ", ""), ...z.stats })) ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8 }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="vehiclesPassed" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Total Kendaraan" />
              <Bar dataKey="taxableVehicles" fill="#10B981" radius={[4, 4, 0, 0]} name="Kena Tarif" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4 text-sm text-text-secondary">
        <strong className="text-white">💡 Catatan:</strong> Data ERP ini merupakan simulasi berbasis volume kendaraan yang dikalibrasi 
        terhadap data pelanggaran aktual di sistem. Implementasi nyata memerlukan sensor loop-detector fisik dan 
        integrasi dengan sistem backend BPTJ Kemenhub.
      </div>
    </div>
  );
}
