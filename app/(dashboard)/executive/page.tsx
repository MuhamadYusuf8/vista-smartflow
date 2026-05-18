"use client";

import { useEffect, useState, useRef } from "react";
import {
  getDailyViolationBase, getPADToday, getCorridorSpeed,
  getVolumePerHour, getCongestionFactor, getLossTimeMinutes,
  CORRIDOR_CAMERAS, TOP_INTERSECTIONS, VIOLATION_TYPES_PILOT,
  getHourlyTimeline, getPilotSummary,
} from "@/lib/pilot-data";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  Camera, AlertTriangle, TrendingUp, Activity, MapPin,
  Zap, Shield, Clock, ChevronRight, Wifi, Radio,
} from "lucide-react";

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function AnimatedCounter({ target, duration = 1500, prefix = "", suffix = "" }: {
  target: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <span>{prefix}{val.toLocaleString("id-ID")}{suffix}</span>;
}

function PulsingDot({ color = "bg-accent-green" }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

export default function ExecutiveDashboard() {
  const [violations, setViolations] = useState(getDailyViolationBase());
  const [volume, setVolume] = useState(getVolumePerHour());
  const [speed, setSpeed] = useState(getCorridorSpeed());
  const [congestion, setCongestion] = useState(Math.round(getCongestionFactor() * 100));
  const [lossTime, setLossTime] = useState(getLossTimeMinutes());
  const [timeline, setTimeline] = useState(getHourlyTimeline());
  const [time, setTime] = useState(new Date());
  const [recentEvents, setRecentEvents] = useState<{ id: number; cam: string; type: string; plate: string; time: string }[]>([]);
  const summary = getPilotSummary();
  const eventId = useRef(1000);

  const VIOLATION_LABELS: Record<string, string> = {
    ILLEGAL_PARKING: "Parkir Liar", BUSWAY_VIOLATION: "Masuk Busway",
    WRONG_LANE: "Salah Lajur", BICYCLE_LANE_VIOLATION: "Masuk Jalur Sepeda",
    BUS_STOP_VIOLATION: "Berhenti di Halte",
  };
  const PLATE_PREFIXES = ["B", "B", "B", "B", "D", "F"];
  const PLATE_NUMS = ["1234", "5678", "9012", "3456", "7890", "2468", "1357"];
  const PLATE_SUFFIX = ["ABC", "DEF", "GHI", "JKL", "MNO", "PQR", "XYZ"];
  const TYPES = Object.keys(VIOLATION_LABELS);

  function genPlate() {
    const p = PLATE_PREFIXES[Math.floor(Math.random() * PLATE_PREFIXES.length)];
    const n = PLATE_NUMS[Math.floor(Math.random() * PLATE_NUMS.length)];
    const s = PLATE_SUFFIX[Math.floor(Math.random() * PLATE_SUFFIX.length)];
    return `${p} ${n} ${s}`;
  }

  useEffect(() => {
    // Clock tick every second
    const clockInterval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Violation counter increment (1 setiap ~6 detik di jam sibuk)
    const factor = getCongestionFactor();
    const tickMs = Math.round(6000 / Math.max(factor, 0.1));
    const violationInterval = setInterval(() => {
      setViolations((v) => v + 1);
      // Tambah event baru
      const cam = CORRIDOR_CAMERAS[Math.floor(Math.random() * 5)];
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      const plate = genPlate();
      const now = new Date();
      const timeStr = now.toLocaleTimeString("id-ID");
      setRecentEvents((prev) => [
        { id: eventId.current++, cam: cam.name.split("—")[1]?.trim() ?? cam.name, type: VIOLATION_LABELS[type], plate, time: timeStr },
        ...prev.slice(0, 6),
      ]);
    }, tickMs);

    // Volume / speed refresh every 15s
    const metricsInterval = setInterval(() => {
      setVolume(getVolumePerHour());
      setSpeed(getCorridorSpeed());
      setCongestion(Math.round(getCongestionFactor() * 100));
      setLossTime(getLossTimeMinutes());
      setTimeline(getHourlyTimeline());
    }, 15000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(violationInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  const pad = getPADToday(violations);
  const congestionLevel = congestion >= 80 ? "MACET PARAH" : congestion >= 60 ? "MACET SEDANG" : congestion >= 40 ? "LANCAR TERHAMBAT" : "LANCAR";
  const congestionColor = congestion >= 80 ? "text-accent-red" : congestion >= 60 ? "text-accent-amber" : "text-accent-green";

  const violationByType = VIOLATION_TYPES_PILOT.map((v) => ({
    name: v.label,
    count: Math.round(violations * v.count_factor),
    color: v.type === "BUSWAY_VIOLATION" ? "#ef4444" : v.type === "ILLEGAL_PARKING" ? "#f59e0b" : "#3b82f6",
  }));

  return (
    <div className="min-h-screen bg-bg-primary text-white overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="border-b border-border bg-bg-secondary/80 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent-blue flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-white text-sm">VISTA SmartFlow AI</p>
              <p className="text-xs text-text-muted">Koridor Pilot — Jl. Jend. Sudirman</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1">
            <PulsingDot />
            <span className="text-xs font-semibold text-accent-green">LIVE MONITORING</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-3 py-1">
            <Radio className="h-3 w-3 text-accent-blue" />
            <span className="text-xs font-semibold text-accent-blue">
              {CORRIDOR_CAMERAS.filter((c) => c.status === "ACTIVE").length} Kamera Aktif
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-accent-cyan">
            {time.toLocaleTimeString("id-ID")}
          </p>
          <p className="text-xs text-text-muted">
            {time.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-4">

        {/* ─── KPI ROW ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              label: "Pelanggaran Hari Ini",
              value: <AnimatedCounter target={violations} />,
              sub: `+1 setiap ~${Math.round(6 / Math.max(getCongestionFactor(), 0.1))}s`,
              color: "text-accent-red", border: "border-accent-red/20", bg: "bg-accent-red/5",
              icon: AlertTriangle,
            },
            {
              label: "Estimasi PAD Hari Ini",
              value: formatRupiah(pad),
              sub: "30% konversi × Rp 250.000",
              color: "text-accent-green", border: "border-accent-green/20", bg: "bg-accent-green/5",
              icon: TrendingUp,
            },
            {
              label: "Volume Kendaraan/Jam",
              value: <AnimatedCounter target={volume} suffix=" kend" />,
              sub: "Sensor ATCS Sudirman",
              color: "text-accent-amber", border: "border-accent-amber/20", bg: "bg-accent-amber/5",
              icon: Activity,
            },
            {
              label: "Kecepatan Rata-rata",
              value: <span>{speed} <span className="text-sm">km/h</span></span>,
              sub: <span className={`font-bold ${congestionColor}`}>{congestionLevel}</span>,
              color: congestionColor, border: "border-border", bg: "bg-bg-secondary",
              icon: Wifi,
            },
            {
              label: "Delay Perjalanan",
              value: <span>+{lossTime} <span className="text-sm">menit</span></span>,
              sub: "vs. kondisi normal",
              color: "text-accent-cyan", border: "border-accent-cyan/20", bg: "bg-accent-cyan/5",
              icon: Clock,
            },
          ].map((item, i) => (
            <div key={i} className={`rounded-xl border ${item.border} ${item.bg} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-muted font-medium">{item.label}</p>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-2xl font-bold font-heading ${item.color}`}>{item.value}</p>
              <p className="text-xs text-text-muted mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* ─── MAIN CONTENT ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Timeline Chart */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-bg-secondary p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent-cyan" />
                Pelanggaran per Jam — Koridor Sudirman
              </h2>
              <span className="text-xs text-text-muted">Data hari ini · {time.toLocaleDateString("id-ID")}</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline.filter(d => d.violations !== null)}>
                <defs>
                  <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8 }}
                  labelStyle={{ color: "#fff", fontSize: 11 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v} pelanggaran`, "Jumlah"]}
                />
                <Area type="monotone" dataKey="violations" stroke="#ef4444" fill="url(#violGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Violation breakdown */}
            <div className="mt-4 grid grid-cols-5 gap-2">
              {violationByType.map((v) => (
                <div key={v.name} className="text-center">
                  <p className="text-lg font-bold" style={{ color: v.color }}>{v.count}</p>
                  <p className="text-[10px] text-text-muted leading-tight">{v.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Live Events */}
          <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <PulsingDot color="bg-accent-red" />
                Live Events
              </span>
              <span className="text-xs text-text-muted">Real-time</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {recentEvents.length === 0 ? (
                <div className="p-6 text-center text-text-muted text-sm">Menunggu deteksi...</div>
              ) : recentEvents.map((e) => (
                <div key={e.id} className="px-4 py-3 hover:bg-bg-tertiary/40 transition-colors animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-sm font-bold text-accent-red">{e.plate}</span>
                    <span className="text-[10px] text-text-muted font-mono">{e.time}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{e.type}</p>
                  <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                    <Camera className="h-3 w-3" />{e.cam}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── CAMERA STATUS + TOP LOCATIONS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Camera Status */}
          <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg-tertiary">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Camera className="h-4 w-4 text-accent-blue" />
                Status Kamera — Koridor Sudirman ({CORRIDOR_CAMERAS.length} Unit)
              </h3>
            </div>
            <div className="divide-y divide-border">
              {CORRIDOR_CAMERAS.map((cam, i) => (
                <div key={cam.id} className="px-5 py-3 flex items-center justify-between hover:bg-bg-tertiary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${cam.status === "ACTIVE" ? "bg-accent-green animate-pulse" : "bg-accent-amber"}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{cam.name}</p>
                      <p className="text-xs text-text-muted font-mono">{cam.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      cam.status === "ACTIVE"
                        ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                        : "bg-accent-amber/10 text-accent-amber border border-accent-amber/20"
                    }`}>{cam.status}</span>
                    <p className="text-xs text-text-muted mt-0.5">
                      {cam.status === "ACTIVE" ? `${Math.round(violations / 5 * (0.8 + i * 0.08))} deteksi` : "Maintenance"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Intersections Risk */}
          <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent-amber" />
                Risiko Kecelakaan — Top Persimpangan
              </h3>
              <span className="text-xs text-text-muted">Diperbarui tiap 30 menit</span>
            </div>
            <div className="p-4 space-y-3">
              {TOP_INTERSECTIONS.map((loc, i) => (
                <div key={loc.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted">#{i + 1}</span>
                      <p className="text-sm font-medium text-white flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-text-muted" />
                        {loc.name}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${
                      loc.risk >= 80 ? "text-accent-red" : loc.risk >= 65 ? "text-accent-amber" : "text-accent-green"
                    }`}>{loc.risk}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        loc.risk >= 80 ? "bg-accent-red" : loc.risk >= 65 ? "bg-accent-amber" : "bg-accent-green"
                      }`}
                      style={{ width: `${loc.risk}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 30-day Summary */}
            <div className="px-4 pb-4">
              <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-3">
                <p className="text-xs text-accent-blue font-semibold mb-2">📊 Ringkasan 30 Hari Pilot</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-white">{summary.anprAccuracy}%</p>
                    <p className="text-[10px] text-text-muted">Akurasi ANPR</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-accent-green">{summary.uptime}%</p>
                    <p className="text-[10px] text-text-muted">Uptime Sistem</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-accent-cyan">{summary.avgResponseTime}m</p>
                    <p className="text-[10px] text-text-muted">Resp. Alert</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── PILOT TOTAL SUMMARY BAR ─── */}
        <div className="rounded-xl border border-accent-green/20 bg-gradient-to-r from-accent-green/10 via-bg-secondary to-accent-blue/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                Total Hasil Pilot 30 Hari — Koridor Sudirman (5 Kamera, 12 km)
              </p>
              <p className="font-heading text-2xl font-bold text-white">
                {formatRupiah(summary.pad)}
                <span className="text-sm font-normal text-accent-green ml-2">Potensi PAD</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { label: "Total Pelanggaran", val: summary.totalViolations.toLocaleString("id-ID"), color: "text-accent-red" },
                { label: "Terkonversi Tilang", val: summary.converted.toLocaleString("id-ID"), color: "text-accent-amber" },
                { label: "Kamera Aktif", val: `${summary.cameraCount} Unit`, color: "text-accent-cyan" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-accent-green">
              <Shield className="h-4 w-4" />
              <span className="font-semibold">Sistem Berjalan Normal</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
