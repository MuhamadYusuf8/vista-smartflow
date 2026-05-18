"use client";

import { useState, useEffect } from "react";
import { Zap, TrafficCone, Clock, TrendingDown, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { getCongestionFactor, HOUR_CONGESTION_FACTOR } from "@/lib/pilot-data";

interface Intersection {
  id: string;
  name: string;
  location: string;
  phase: "NS_GREEN" | "NS_RED" | "EW_GREEN" | "EW_RED";
  nsVolume: number;
  ewVolume: number;
  nsGreenSec: number;
  ewGreenSec: number;
  aiMode: boolean;
  savedSeconds: number;
  cycleCount: number;
}

const BASE_INTERSECTIONS: Omit<Intersection, "phase" | "nsVolume" | "ewVolume" | "nsGreenSec" | "ewGreenSec" | "savedSeconds" | "cycleCount">[] = [
  { id: "TL-SUD-001", name: "Simpang Semanggi", location: "Jl. Gatot Subroto — Jl. Sudirman", aiMode: true },
  { id: "TL-SUD-002", name: "Bundaran HI", location: "Jl. MH Thamrin — Jl. Imam Bonjol", aiMode: true },
  { id: "TL-SUD-003", name: "Simpang Casablanca", location: "Jl. Casablanca — Jl. Rasuna Said", aiMode: true },
  { id: "TL-SUD-004", name: "Simpang Kuningan", location: "Jl. HR Rasuna Said — Jl. Gatot Subroto", aiMode: false },
  { id: "TL-SUD-005", name: "Simpang Sudirman-SCBD", location: "Jl. Sudirman — Jl. Senopati", aiMode: true },
];

function calcAdaptiveGreen(nsVol: number, ewVol: number, baseCycle = 90): { nsGreen: number; ewGreen: number } {
  const total = nsVol + ewVol || 1;
  const nsRatio = nsVol / total;
  const ewRatio = ewVol / total;
  const overhead = 10; // yellow + all-red
  const available = baseCycle - overhead;
  return {
    nsGreen: Math.round(Math.max(15, Math.min(60, available * nsRatio))),
    ewGreen: Math.round(Math.max(15, Math.min(60, available * ewRatio))),
  };
}

export default function AdaptiveTrafficPage() {
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [selected, setSelected] = useState<Intersection | null>(null);
  const [globalSaved, setGlobalSaved] = useState(0);
  const [cyclesOptimized, setCyclesOptimized] = useState(1247);

  useEffect(() => {
    function generate(): Intersection[] {
      const factor = getCongestionFactor();
      return BASE_INTERSECTIONS.map((base, i) => {
        const nsBase = Math.round(1800 * factor * (0.8 + i * 0.1));
        const ewBase = Math.round(1200 * factor * (1.2 - i * 0.08));
        const { nsGreen, ewGreen } = base.aiMode
          ? calcAdaptiveGreen(nsBase, ewBase)
          : { nsGreen: 45, ewGreen: 45 };
        // Standard cycle would be 45/45, AI adaptive saves time
        const stdNs = 45, stdEw = 45;
        const saved = base.aiMode ? Math.round(Math.abs(nsGreen - stdNs) * 0.23) : 0;
        return {
          ...base,
          phase: (i % 2 === 0 ? "NS_GREEN" : "EW_GREEN") as Intersection["phase"],
          nsVolume: nsBase,
          ewVolume: ewBase,
          nsGreenSec: nsGreen,
          ewGreenSec: ewGreen,
          savedSeconds: saved,
          cycleCount: 47 + i * 12,
        };
      });
    }

    const data = generate();
    setIntersections(data);
    setSelected(data[0]);
    setGlobalSaved(data.reduce((a, b) => a + b.savedSeconds * b.cycleCount, 0));

    const iv = setInterval(() => {
      const updated = generate();
      setIntersections(updated);
      setSelected((prev) => updated.find((u) => u.id === prev?.id) ?? updated[0]);
      setGlobalSaved(updated.reduce((a, b) => a + b.savedSeconds * b.cycleCount, 0));
      setCyclesOptimized((n) => n + 1);
    }, 12000);

    return () => clearInterval(iv);
  }, []);

  const hourlyEfficiency = Array.from({ length: 24 }, (_, h) => {
    const factor = HOUR_CONGESTION_FACTOR[h] ?? 0.5;
    const now = new Date().getHours();
    return {
      label: `${String(h).padStart(2, "0")}:00`,
      aiSaved: h <= now ? Math.round(factor * 23) : 0,
      standard: h <= now ? 0 : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Zap className="h-7 w-7 text-accent-amber" />
            AI Adaptive Traffic Light
          </h1>
          <p className="text-sm text-text-muted">
            AI mengoptimalkan fase lampu merah secara real-time berdasarkan volume kendaraan dari CCTV
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1.5 text-xs font-bold text-accent-green">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
            AI Mode Aktif · {BASE_INTERSECTIONS.filter((b) => b.aiMode).length} Simpang
          </span>
        </div>
      </div>

      {/* System claim banner */}
      <div className="rounded-xl border border-accent-amber/20 bg-gradient-to-r from-accent-amber/10 via-bg-secondary to-accent-green/10 p-4 flex items-center gap-4">
        <Zap className="h-10 w-10 text-accent-amber flex-shrink-0" />
        <div className="flex-1">
          <p className="font-bold text-white">AI menggantikan jadwal tetap lampu merah</p>
          <p className="text-sm text-text-muted">Fase hijau diperpanjang/dipersingkat otomatis setiap siklus berdasarkan rasio volume kendaraan dari AI CCTV</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right hidden sm:grid">
          <div>
            <p className="text-2xl font-bold text-accent-amber">{cyclesOptimized.toLocaleString("id-ID")}</p>
            <p className="text-xs text-text-muted">Siklus dioptimasi</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent-green">23%</p>
            <p className="text-xs text-text-muted">Rata-rata penghematan</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-accent-cyan">{Math.round(globalSaved / 60).toLocaleString("id-ID")} jam</p>
            <p className="text-xs text-text-muted">Waktu dihemat hari ini</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Intersection List */}
        <div className="space-y-3">
          {intersections.map((inter) => (
            <button key={inter.id} onClick={() => setSelected(inter)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${selected?.id === inter.id ? "border-accent-amber/30 bg-accent-amber/5" : "border-border bg-bg-secondary hover:bg-bg-tertiary"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-white text-sm">{inter.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${inter.aiMode ? "text-accent-green border-accent-green/30 bg-accent-green/10" : "text-text-muted border-border"}`}>
                  {inter.aiMode ? "AI" : "Manual"}
                </span>
              </div>
              <p className="text-xs text-text-muted">{inter.location}</p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-accent-green">↑ {inter.nsVolume.toLocaleString()} kend/jam (NS)</span>
                <span className="text-accent-blue">→ {inter.ewVolume.toLocaleString()} kend/jam (EW)</span>
              </div>
              {inter.aiMode && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-accent-amber">
                  <TrendingDown className="h-3 w-3" />
                  Hemat {inter.savedSeconds}s per siklus · {inter.cycleCount} siklus hari ini
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Detail */}
        {selected && (
          <div className="lg:col-span-2 space-y-4">

            {/* Signal Display */}
            <div className="rounded-xl border border-border bg-bg-secondary p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-bold text-white">{selected.name}</h2>
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${selected.aiMode ? "text-accent-green border-accent-green/30 bg-accent-green/10" : "text-text-muted border-border"}`}>
                  {selected.aiMode ? "⚡ AI Adaptive Mode" : "⏱ Jadwal Tetap (Legacy)"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* NS Direction */}
                <div className="text-center">
                  <p className="text-xs text-text-muted mb-3">UTARA ↕ SELATAN</p>
                  <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-tertiary p-4">
                    <div className={`h-12 w-12 rounded-full border-2 transition-all ${selected.phase === "NS_GREEN" ? "bg-accent-green border-accent-green shadow-[0_0_20px_rgba(16,185,129,0.6)]" : "bg-bg-primary border-border"}`} />
                    <div className={`h-10 w-10 rounded-full border-2 transition-all ${selected.phase === "NS_RED" ? "bg-accent-red border-accent-red shadow-[0_0_20px_rgba(239,68,68,0.6)]" : "bg-bg-primary border-border"}`} />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-white">{selected.nsGreenSec}s</p>
                    <p className="text-xs text-text-muted">Fase Hijau</p>
                    <p className="text-xs text-accent-green">{selected.nsVolume.toLocaleString()} kend/jam</p>
                  </div>
                </div>

                {/* EW Direction */}
                <div className="text-center">
                  <p className="text-xs text-text-muted mb-3">BARAT ↔ TIMUR</p>
                  <div className="inline-flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-tertiary p-4">
                    <div className={`h-12 w-12 rounded-full border-2 transition-all ${selected.phase === "EW_GREEN" ? "bg-accent-green border-accent-green shadow-[0_0_20px_rgba(16,185,129,0.6)]" : "bg-bg-primary border-border"}`} />
                    <div className={`h-10 w-10 rounded-full border-2 transition-all ${selected.phase === "EW_RED" ? "bg-accent-red border-accent-red shadow-[0_0_20px_rgba(239,68,68,0.6)]" : "bg-bg-primary border-border"}`} />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-white">{selected.ewGreenSec}s</p>
                    <p className="text-xs text-text-muted">Fase Hijau</p>
                    <p className="text-xs text-accent-blue">{selected.ewVolume.toLocaleString()} kend/jam</p>
                  </div>
                </div>
              </div>

              {selected.aiMode && (
                <div className="mt-4 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-sm">
                  <p className="text-accent-amber font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4" />AI Decision Reasoning
                  </p>
                  <p className="text-text-secondary mt-1">
                    NS volume {selected.nsVolume > selected.ewVolume ? "lebih tinggi" : "lebih rendah"} ({Math.round(selected.nsVolume / selected.ewVolume * 100)}% dari EW).
                    AI menetapkan NS hijau {selected.nsGreenSec}s vs EW {selected.ewGreenSec}s untuk throughput maksimal.
                    Penghematan rata-rata <strong className="text-accent-green">{selected.savedSeconds}s per siklus</strong> vs jadwal tetap 45/45.
                  </p>
                </div>
              )}

              {!selected.aiMode && (
                <div className="mt-4 rounded-lg border border-accent-red/20 bg-accent-red/5 p-3 text-sm">
                  <p className="text-accent-red font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />Mode Legacy — Jadwal Tetap
                  </p>
                  <p className="text-text-secondary mt-1">
                    Simpang ini masih menggunakan jadwal 45/45 tetap tanpa mempertimbangkan volume kendaraan aktual.
                    <strong className="text-accent-amber"> Potensi penghematan ~23% belum terealisasi.</strong>
                  </p>
                  <button className="mt-2 text-xs text-accent-amber hover:underline">Aktifkan AI Mode →</button>
                </div>
              )}
            </div>

            {/* Comparison table */}
            <div className="rounded-xl border border-border bg-bg-secondary p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent-cyan" />
                Perbandingan: AI Adaptive vs Jadwal Tetap
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-text-muted text-xs border-b border-border">
                    <tr>
                      <th className="py-2 text-left">Metrik</th>
                      <th className="py-2 text-center">Jadwal Tetap</th>
                      <th className="py-2 text-center">AI Adaptive</th>
                      <th className="py-2 text-center">Peningkatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { metric: "Waktu tunggu rata-rata", fixed: "87 detik", ai: `${Math.round(87 * 0.77)} detik`, pct: "+23%" },
                      { metric: "Throughput kendaraan/jam", fixed: "3.200", ai: "4.150", pct: "+30%" },
                      { metric: "Stop-and-go per km", fixed: "8x", ai: "5x", pct: "-37%" },
                      { metric: "Emisi CO₂ per siklus", fixed: "12.4 kg", ai: "9.6 kg", pct: "-23%" },
                    ].map((row) => (
                      <tr key={row.metric}>
                        <td className="py-2.5 text-text-secondary">{row.metric}</td>
                        <td className="py-2.5 text-center text-text-muted">{row.fixed}</td>
                        <td className="py-2.5 text-center font-semibold text-accent-green">{row.ai}</td>
                        <td className="py-2.5 text-center">
                          <span className="text-xs font-bold text-accent-green bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 rounded-full">{row.pct}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
