"use client";

import { useState, useEffect } from "react";
import { Leaf, TrendingDown, TrendingUp, Wind, Car, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { HOUR_CONGESTION_FACTOR, getCongestionFactor, getVolumePerHour } from "@/lib/pilot-data";

// CO₂ emission factors (gram per km)
const EMISSION_FACTORS = { CAR: 147, MOTORCYCLE: 72, BUS: 68, TRUCK: 210 };
// Vehicle mix (%) for Jakarta
const VEHICLE_MIX = { CAR: 0.58, MOTORCYCLE: 0.31, BUS: 0.04, TRUCK: 0.07 };
// RPJMD DKI target: net zero 2050. Current baseline: 4.2 juta ton CO₂/year transport
const ANNUAL_BASELINE_TON = 4_200_000;

function calcEmissionGram(volume: number): number {
  return Object.entries(VEHICLE_MIX).reduce((sum, [type, pct]) => {
    const factor = EMISSION_FACTORS[type as keyof typeof EMISSION_FACTORS];
    return sum + volume * pct * factor * 12; // avg trip 12 km
  }, 0);
}

function formatTon(gram: number) {
  const ton = gram / 1_000_000;
  if (ton >= 1000) return `${(ton / 1000).toFixed(2)} kt`;
  return `${ton.toFixed(2)} ton`;
}

function formatCO2Short(gram: number) {
  if (gram >= 1_000_000) return `${(gram / 1_000_000).toFixed(1)} ton`;
  if (gram >= 1000) return `${(gram / 1000).toFixed(0)} kg`;
  return `${gram.toFixed(0)} g`;
}

const CORRIDORS = [
  { name: "Jl. Sudirman", factor: 1.0, gageFactor: 0.82 },
  { name: "Jl. Gatot Subroto", factor: 0.92, gageFactor: 0.80 },
  { name: "Jl. Casablanca", factor: 0.85, gageFactor: 0.78 },
  { name: "Jl. TB Simatupang", factor: 0.78, gageFactor: 0.75 },
  { name: "Tol Dalam Kota", factor: 1.15, gageFactor: 0.88 },
];

export default function CarbonTrackerPage() {
  const [currentEmission, setCurrentEmission] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [hourlyData, setHourlyData] = useState<{ label: string; emission: number; withGage: number; volume: number }[]>([]);
  const [gageActive, setGageActive] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const tick = () => {
      const volume = getVolumePerHour();
      const gram = calcEmissionGram(volume);
      const factor = gageActive ? 0.82 : 1.0;
      setCurrentEmission(gram * factor);

      const now = new Date();
      const h = now.getHours();
      let daily = 0;
      const data = Array.from({ length: 24 }, (_, i) => {
        const hFactor = HOUR_CONGESTION_FACTOR[i] ?? 0.5;
        const vol = Math.round(3200 * hFactor);
        const em = calcEmissionGram(vol);
        const withGage = em * 0.82;
        if (i <= h) daily += gageActive ? withGage : em;
        return { label: `${String(i).padStart(2, "0")}:00`, emission: i <= h ? em : 0, withGage: i <= h ? withGage : 0, volume: i <= h ? vol : 0 };
      });
      setHourlyData(data);
      setDailyTotal(daily);
    };
    tick();
    const iv = setInterval(tick, 15000);
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => { clearInterval(iv); clearInterval(clock); };
  }, [gageActive]);

  const annualProjection = dailyTotal * 365 * 6; // 6 corridors × 365 days
  const reductionPct = ((1 - 0.82) * 100).toFixed(0);
  const targetProgress = Math.min((1 - annualProjection / (ANNUAL_BASELINE_TON * 1_000_000)) * 100, 99);

  const corridorData = CORRIDORS.map((c) => {
    const baseVol = Math.round(getVolumePerHour() * c.factor);
    const emission = calcEmissionGram(baseVol);
    const withGage = emission * c.gageFactor;
    return { ...c, emission, withGage, reduction: ((1 - c.gageFactor) * 100).toFixed(0), baseVol };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Leaf className="h-7 w-7 text-accent-green" />
            Carbon Emission Tracker
          </h1>
          <p className="text-sm text-text-muted">
            Emisi CO₂ real-time berbasis volume kendaraan CCTV · Target RPJMD DKI Net Zero 2050
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setGageActive((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${gageActive ? "border-accent-green/30 bg-accent-green/10 text-accent-green" : "border-border bg-bg-secondary text-text-muted hover:text-white"}`}>
            <Car className="h-4 w-4" />
            Ganjil Genap {gageActive ? "Aktif ✓" : "Nonaktif"}
          </button>
          <div className="font-mono text-sm text-accent-cyan">{time.toLocaleTimeString("id-ID")}</div>
        </div>
      </div>

      {/* Unique badge */}
      <div className="rounded-xl border border-accent-green/20 bg-gradient-to-r from-accent-green/10 via-bg-secondary to-accent-blue/10 p-4 flex items-center gap-4">
        <Leaf className="h-10 w-10 text-accent-green flex-shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-white">🇮🇩 Pertama di Indonesia</p>
          <p className="text-sm text-text-muted">Satu-satunya kota di Indonesia dengan data emisi transportasi REAL-TIME berbasis AI. Laporan otomatis ke KLHK setiap bulan.</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-2xl font-bold text-accent-green">-{reductionPct}%</p>
          <p className="text-xs text-text-muted">Reduksi emisi dari Ganjil-Genap</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Emisi/Jam Sekarang", val: formatCO2Short(currentEmission), sub: "Koridor Sudirman", color: "text-accent-amber", icon: Wind },
          { label: "Total Emisi Hari Ini", val: formatTon(dailyTotal), sub: "6 Koridor Utama", color: "text-accent-red", icon: BarChart3 },
          { label: "Proyeksi Tahunan", val: formatTon(annualProjection), sub: `Baseline: ${(ANNUAL_BASELINE_TON / 1000).toFixed(0)} kt/tahun`, color: "text-text-secondary", icon: TrendingUp },
          { label: "Progress Net Zero 2050", val: `${targetProgress.toFixed(1)}%`, sub: "Target RPJMD DKI Jakarta", color: "text-accent-green", icon: CheckCircle2 },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-muted">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`text-2xl font-bold font-heading ${k.color}`}>{k.val}</p>
            <p className="text-xs text-text-muted mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-bg-secondary p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wind className="h-4 w-4 text-accent-amber" />
              Emisi CO₂ per Jam Hari Ini
            </h3>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-accent-red inline-block" /> Tanpa GaGe</span>
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-accent-green inline-block" /> Dengan GaGe</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="emGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} interval={3} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8, fontSize: 11 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [formatCO2Short(Number(v)), name === "emission" ? "Tanpa GaGe" : "Dengan GaGe"]}
              />
              <Area type="monotone" dataKey="emission" stroke="#ef4444" fill="url(#emGrad)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="withGage" stroke="#10b981" fill="url(#gageGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-3 rounded-lg border border-accent-green/20 bg-accent-green/5 p-3 text-sm text-accent-green">
            💡 Kebijakan Ganjil-Genap mengurangi emisi CO₂ sebesar <strong>{reductionPct}%</strong> — setara menanam <strong>{Math.round(dailyTotal / 1_000_000 / 21.7 * 1000).toLocaleString("id-ID")}</strong> pohon per hari
          </div>
        </div>

        {/* Corridor breakdown */}
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary">
            <h3 className="text-sm font-semibold text-white">Emisi per Koridor</h3>
          </div>
          <div className="p-4 space-y-3">
            {corridorData.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-white">{c.name}</p>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-accent-green" />
                    <span className="text-xs font-bold text-accent-green">-{c.reduction}%</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-accent-amber" style={{ width: `${Math.min((c.emission / 5_000_000) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <p className="text-[10px] text-text-muted">{formatCO2Short(gageActive ? c.withGage : c.emission)}/jam</p>
                  <p className="text-[10px] text-text-muted">{c.baseVol.toLocaleString("id-ID")} kend/jam</p>
                </div>
              </div>
            ))}
          </div>
          {/* Monthly report */}
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-3">
              <p className="text-xs text-accent-blue font-semibold mb-1">📋 Laporan Bulanan → KLHK</p>
              <p className="text-xs text-text-muted">Laporan otomatis PDF dikirim ke Kementerian LHK setiap tanggal 1</p>
              <button className="mt-2 text-xs text-accent-blue hover:underline">Unduh Laporan Mei 2026 →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
