"use client";

import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, Car, Shield, Zap, Radio, MapPin,
  Phone, Clock, CheckCircle2, XCircle, RefreshCw,
  Flame, Droplets, Ambulance, Truck,
} from "lucide-react";

// ── Jakarta area data ──
const ZONES = [
  { id: "JakSel", name: "Jakarta Selatan", cams: 52, lat: -6.2615, lng: 106.8106 },
  { id: "JakPus", name: "Jakarta Pusat", cams: 48, lat: -6.1862, lng: 106.8300 },
  { id: "JakBar", name: "Jakarta Barat", cams: 41, lat: -6.1680, lng: 106.7557 },
  { id: "JakTim", name: "Jakarta Timur", cams: 44, lat: -6.2250, lng: 106.9000 },
  { id: "JakUt", name: "Jakarta Utara", cams: 38, lat: -6.1184, lng: 106.9000 },
  { id: "Tangerang", name: "Tangerang (Buffer)", cams: 14, lat: -6.1781, lng: 106.6300 },
  { id: "Bekasi", name: "Bekasi (Buffer)", cams: 10, lat: -6.2349, lng: 106.9896 },
];

type IncidentType = "KECELAKAAN" | "KENDARAAN_MOGOK" | "BANJIR" | "KEBAKARAN" | "BURONAN" | "KEMACETAN_KRITIS";

interface Incident {
  id: string;
  type: IncidentType;
  location: string;
  zone: string;
  severity: "KRITIS" | "TINGGI" | "SEDANG";
  reportedAt: string;
  status: "BARU" | "DITANGANI" | "SELESAI";
  source: "AI_CCTV" | "JAKI" | "TMC" | "POLRI" | "WAZE";
  responders: string[];
  responseTime?: number; // menit
}

const INCIDENT_ICONS: Record<IncidentType, React.ElementType> = {
  KECELAKAAN: Ambulance,
  KENDARAAN_MOGOK: Truck,
  BANJIR: Droplets,
  KEBAKARAN: Flame,
  BURONAN: Shield,
  KEMACETAN_KRITIS: AlertTriangle,
};

const INCIDENT_COLORS: Record<IncidentType, string> = {
  KECELAKAAN: "text-accent-red border-accent-red/30 bg-accent-red/10",
  KENDARAAN_MOGOK: "text-accent-amber border-accent-amber/30 bg-accent-amber/10",
  BANJIR: "text-accent-blue border-accent-blue/30 bg-accent-blue/10",
  KEBAKARAN: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  BURONAN: "text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10",
  KEMACETAN_KRITIS: "text-accent-amber border-accent-amber/30 bg-accent-amber/10",
};

const LOCATIONS = [
  "Jl. Gatot Subroto — Semanggi", "Jl. MT Haryono Km 7", "Bundaran HI",
  "Jl. Casablanca — Kokas", "Tol Dalam Kota arah Cawang", "Jl. TB Simatupang",
  "Jl. Sudirman — Blok M", "Jl. Rasuna Said Kuningan", "Jl. HR Rasuna — Mampang",
  "Tol Jagorawi Km 3", "Jl. Gunung Sahari — Mangga Dua",
];

const SOURCES_ICONS: Record<string, string> = {
  AI_CCTV: "🎥", JAKI: "📱", TMC: "📡", POLRI: "🚓", WAZE: "🗺️",
};

function generateIncident(idx: number, timeOffset = 0): Incident {
  const types: IncidentType[] = ["KECELAKAAN", "KENDARAAN_MOGOK", "BANJIR", "KEBAKARAN", "BURONAN", "KEMACETAN_KRITIS"];
  const sources: Incident["source"][] = ["AI_CCTV", "AI_CCTV", "JAKI", "TMC", "WAZE", "POLRI"];
  const severities: Incident["severity"][] = ["KRITIS", "TINGGI", "SEDANG"];
  const responderSets: Record<IncidentType, string[]> = {
    KECELAKAAN: ["Ambulans 118", "Polisi Lalu Lintas"],
    KENDARAAN_MOGOK: ["Derek Dinas Perhubungan", "Patroli Jalan Raya"],
    BANJIR: ["BPBD Jakarta", "Pemadam"],
    KEBAKARAN: ["Dinas Kebakaran", "PMI"],
    BURONAN: ["Satuan Sabhara Polda Metro", "Intelijen"],
    KEMACETAN_KRITIS: ["Gatur Lantas Mobile", "TMC Jakarta"],
  };

  const type = types[idx % types.length];
  const t = new Date(Date.now() - timeOffset * 60000);
  return {
    id: `INC-${(Date.now() - timeOffset * 1000).toString(36).slice(-6).toUpperCase()}`,
    type,
    location: LOCATIONS[idx % LOCATIONS.length],
    zone: ZONES[idx % ZONES.length].name,
    severity: severities[idx % severities.length],
    reportedAt: t.toLocaleTimeString("id-ID"),
    status: timeOffset > 8 ? "DITANGANI" : timeOffset > 20 ? "SELESAI" : "BARU",
    source: sources[idx % sources.length],
    responders: responderSets[type],
    responseTime: timeOffset > 3 ? Math.round(1.5 + Math.random() * 2.5) : undefined,
  };
}

function PulsingDot({ color = "bg-accent-green", size = "h-2 w-2" }: { color?: string; size?: string }) {
  return (
    <span className="relative flex" style={{ height: "10px", width: "10px" }}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full ${size} ${color}`} />
    </span>
  );
}

export default function CommandCenterPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchDone, setDispatchDone] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState({ total: 0, kritis: 0, ditangani: 0, responseAvg: 0 });
  const [liveTraffic, setLiveTraffic] = useState<{
    level: string; score: number; color: string; source: string;
    cameras: { name: string; location: string; congestion: number; count: number }[];
  } | null>(null);
  const incIdx = useRef(50);

  useEffect(() => {
    // Seed initial incidents (simulating last 30 mins)
    const initial = Array.from({ length: 8 }, (_, i) => generateIncident(i, (8 - i) * 3.5));
    setIncidents(initial);
    setSelected(initial[0]);

    const clockInterval = setInterval(() => setTime(new Date()), 1000);

    // ── Fetch traffic metrics live ───────────────────────────────────────────────
    async function fetchTraffic() {
      try {
        const res = await fetch("/api/traffic-metrics?hours=1");
        const json = await res.json();
        if (json.cameras && json.cameras.length > 0) {
          const summary = json.city_summary;
          const cams = json.cameras as { name: string; location: string; avg_congestion: number; latest_count: number }[];
          setLiveTraffic({
            level: summary.congestion_level,
            score: Math.round(summary.avg_congestion * 100),
            color: summary.avg_congestion >= 0.8 ? "#EF4444"
              : summary.avg_congestion >= 0.55 ? "#F97316"
              : summary.avg_congestion >= 0.3  ? "#F59E0B"
              : "#10B981",
            source: json._source ?? "unknown",
            cameras: cams.map((c) => ({ name: c.name, location: c.location, congestion: c.avg_congestion, count: c.latest_count })),
          });
        }
      } catch { /* silent */ }
    }
    fetchTraffic();
    const trafficInterval = setInterval(fetchTraffic, 60000);

    // New incident every 25-40 seconds
    const incidentInterval = setInterval(() => {
      const newInc = generateIncident(incIdx.current++, 0);
      setIncidents((prev) => {
        const updated = [newInc, ...prev.slice(0, 11)];
        setStats({
          total: updated.length,
          kritis: updated.filter((i) => i.severity === "KRITIS").length,
          ditangani: updated.filter((i) => i.status === "DITANGANI").length,
          responseAvg: Math.round(updated.filter((i) => i.responseTime).reduce((a, b) => a + (b.responseTime ?? 0), 0) / Math.max(1, updated.filter((i) => i.responseTime).length) * 10) / 10,
        });
        return updated;
      });
    }, 28000 + Math.random() * 12000);

    return () => { clearInterval(clockInterval); clearInterval(trafficInterval); clearInterval(incidentInterval); };
  }, []);

  const handleDispatch = () => {
    if (!selected) return;
    setDispatching(true);
    setTimeout(() => {
      setDispatching(false);
      setDispatchDone(selected.id);
      setIncidents((prev) =>
        prev.map((i) => i.id === selected.id ? { ...i, status: "DITANGANI", responseTime: Math.round(1.5 + Math.random() * 2) } : i)
      );
      setTimeout(() => setDispatchDone(null), 3000);
    }, 2000);
  };

  const severityColor = (s: string) =>
    s === "KRITIS" ? "text-accent-red bg-accent-red/10 border-accent-red/30" :
    s === "TINGGI" ? "text-accent-amber bg-accent-amber/10 border-accent-amber/30" :
    "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Radio className="h-7 w-7 text-accent-red animate-pulse" />
            Command Center — Jakarta War Room
          </h1>
          <p className="text-sm text-text-muted">
            VISTA + JAKI + TMC + Polri + Waze · Single pane of glass · {ZONES.reduce((a, z) => a + z.cams, 0)} kamera aktif
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-accent-red/20 bg-accent-red/10 px-3 py-1.5">
            <PulsingDot color="bg-accent-red" />
            <span className="text-xs font-bold text-accent-red">LIVE · WAR ROOM MODE</span>
          </div>
          <div className="font-mono text-lg font-bold text-accent-cyan">
            {time.toLocaleTimeString("id-ID")}
          </div>
        </div>
      </div>

      {/* Data Source Badges */}
      <div className="flex flex-wrap gap-2">
        {[
          { src: "VISTA AI", color: "border-accent-blue/30 bg-accent-blue/10 text-accent-blue", dot: "bg-accent-blue" },
          { src: "JAKI Warga", color: "border-accent-green/30 bg-accent-green/10 text-accent-green", dot: "bg-accent-green" },
          { src: "TMC Jakarta", color: "border-accent-amber/30 bg-accent-amber/10 text-accent-amber", dot: "bg-accent-amber" },
          { src: "Polda Metro", color: "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan", dot: "bg-accent-cyan" },
          { src: "Waze for Cities", color: "border-purple-400/30 bg-purple-400/10 text-purple-400", dot: "bg-purple-400" },
        ].map((s) => (
          <span key={s.src} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${s.dot}`} />
            {s.src}
          </span>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Insiden Aktif", val: incidents.filter((i) => i.status !== "SELESAI").length, color: "text-accent-red" },
          { label: "Level Kritis", val: incidents.filter((i) => i.severity === "KRITIS").length, color: "text-accent-red" },
          { label: "Sedang Ditangani", val: incidents.filter((i) => i.status === "DITANGANI").length, color: "text-accent-amber" },
          { label: "Avg Response Time", val: `${stats.responseAvg || 2.3} mnt`, color: "text-accent-green" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-bg-secondary p-3">
            <p className="text-xs text-text-muted">{k.label}</p>
            <p className={`text-2xl font-bold font-heading ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Zone Overview — enriched with live traffic if available */}
      <div className="rounded-xl border border-border bg-bg-secondary p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent-blue" />
            Cakupan Wilayah — {ZONES.reduce((a, z) => a + z.cams, 0)} Kamera Aktif
          </h3>
          {liveTraffic && (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold border"
              style={{ color: liveTraffic.color, borderColor: `${liveTraffic.color}40`, backgroundColor: `${liveTraffic.color}15` }}
            >
              Kota: {liveTraffic.level} ({liveTraffic.score}/100)
            </span>
          )}
        </div>

        {/* Live CCTV camera congestion bars — shown if DB data available */}
        {liveTraffic && liveTraffic.cameras.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-bg-tertiary border border-border">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
              Tingkat Kemacetan Per Kamera — Live
              <span className={`ml-2 ${
                liveTraffic.source.includes("VISTA_TrafficMetrics") ? "text-accent-green" : "text-accent-amber"
              }`}>
                {liveTraffic.source.includes("VISTA_TrafficMetrics") ? "🟢 DB Live" : "🟡 Estimasi"}
              </span>
            </p>
            <div className="flex items-end gap-1.5 h-12">
              {liveTraffic.cameras.map((cam) => {
                const pct = Math.round(cam.congestion * 100);
                const barColor = pct >= 80 ? "#EF4444" : pct >= 55 ? "#F97316" : pct >= 30 ? "#F59E0B" : "#10B981";
                return (
                  <div key={cam.name} className="flex flex-col items-center gap-0.5 flex-1">
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: `${Math.max(4, pct * 0.44)}px`, backgroundColor: barColor, opacity: 0.85 }}
                      title={`${cam.name}: ${pct}% macet, ${cam.count} kend/jam`}
                    />
                    <span className="text-[8px] text-text-muted truncate w-full text-center">
                      {cam.name.replace("CCTV ", "").split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {ZONES.map((z) => {
            const zoneInc = incidents.filter((i) => i.zone === z.name && i.status !== "SELESAI").length;
            return (
              <div key={z.id} className={`rounded-lg p-2 text-center border ${zoneInc > 0 ? "border-accent-red/30 bg-accent-red/5" : "border-border bg-bg-tertiary"}`}>
                <p className={`text-lg font-bold ${zoneInc > 0 ? "text-accent-red" : "text-accent-green"}`}>{z.cams}</p>
                <p className="text-[10px] text-text-muted leading-tight">{z.name.replace("Jakarta ", "Jak. ")}</p>
                {zoneInc > 0 && <p className="text-[10px] text-accent-red font-bold">{zoneInc} insiden</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Incident List */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <PulsingDot color="bg-accent-red" />
              Live Incidents ({incidents.length})
            </span>
            <span className="text-xs text-text-muted">Multi-source feed</span>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {incidents.map((inc) => {
              const Icon = INCIDENT_ICONS[inc.type];
              const isNew = inc.status === "BARU";
              return (
                <button key={inc.id} onClick={() => setSelected(inc)}
                  className={`w-full text-left px-4 py-3 hover:bg-bg-tertiary/50 transition-colors ${selected?.id === inc.id ? "bg-bg-tertiary" : ""} ${isNew ? "border-l-2 border-accent-red" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 flex-shrink-0 ${INCIDENT_ICONS[inc.type] ? "text-accent-red" : "text-text-muted"}`} />
                      <span className="font-mono text-xs text-text-muted">{inc.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-muted">{SOURCES_ICONS[inc.source]}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityColor(inc.severity)}`}>{inc.severity}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{inc.location}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-text-muted">{inc.type.replace(/_/g, " ")}</p>
                    <span className={`text-[10px] font-semibold ${inc.status === "BARU" ? "text-accent-red" : inc.status === "DITANGANI" ? "text-accent-amber" : "text-accent-green"}`}>
                      {inc.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted">{inc.reportedAt}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-3 space-y-4">
            <div className={`rounded-xl border-2 p-5 ${INCIDENT_COLORS[selected.type]}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-mono text-text-muted mb-1">{selected.id} · {SOURCES_ICONS[selected.source]} {selected.source.replace(/_/g, " ")}</p>
                  <h2 className="font-heading text-xl font-bold text-white">{selected.type.replace(/_/g, " ")}</h2>
                  <p className="text-sm text-text-secondary flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />{selected.location}
                  </p>
                </div>
                <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${severityColor(selected.severity)}`}>{selected.severity}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Status", val: selected.status },
                  { label: "Dilaporkan", val: selected.reportedAt },
                  { label: "Response Time", val: selected.responseTime ? `${selected.responseTime} mnt` : "Belum dikirim" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-bg-primary/60 p-3">
                    <p className="text-xs text-text-muted">{item.label}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{item.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Responders */}
            <div className="rounded-xl border border-border bg-bg-secondary p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent-green" />
                Unit Responder
              </h3>
              <div className="space-y-2">
                {selected.responders.map((r) => (
                  <div key={r} className="flex items-center justify-between rounded-lg border border-border bg-bg-tertiary p-3">
                    <span className="text-sm text-white">{r}</span>
                    <span className={`text-xs font-semibold ${selected.status === "DITANGANI" ? "text-accent-amber" : selected.status === "SELESAI" ? "text-accent-green" : "text-text-muted"}`}>
                      {selected.status === "DITANGANI" ? "🚨 En Route" : selected.status === "SELESAI" ? "✓ Selesai" : "Standby"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dispatch Button */}
              {selected.status === "BARU" ? (
                <button onClick={handleDispatch} disabled={dispatching}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-red px-4 py-3 text-sm font-bold text-white hover:bg-red-500 transition-all disabled:opacity-60">
                  {dispatching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {dispatching ? "Mengirim Dispatch..." : "⚡ DISPATCH SEMUA UNIT"}
                </button>
              ) : (
                <div className={`mt-4 rounded-lg border p-3 text-center ${selected.status === "DITANGANI" ? "border-accent-amber/30 bg-accent-amber/10" : "border-accent-green/30 bg-accent-green/10"}`}>
                  {selected.status === "DITANGANI" ? (
                    <p className="text-accent-amber font-semibold text-sm">🚨 Unit sedang dalam perjalanan · {selected.responseTime} menit</p>
                  ) : (
                    <p className="text-accent-green font-semibold text-sm">✓ Insiden selesai ditangani</p>
                  )}
                </div>
              )}
              {dispatchDone === selected.id && (
                <div className="mt-2 rounded-lg border border-accent-green/30 bg-accent-green/10 p-2 text-center">
                  <p className="text-xs text-accent-green font-semibold">✅ Dispatch berhasil dikirim · ETA {selected.responseTime} menit</p>
                </div>
              )}
            </div>

            {/* AI Analysis */}
            <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4">
              <h3 className="text-sm font-semibold text-accent-amber mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />AI Auto-Analysis
              </h3>
              <div className="space-y-1.5 text-sm text-text-secondary">
                <p>• Insiden terdeteksi otomatis dari feed CCTV {selected.source === "AI_CCTV" ? "VISTA" : selected.source}</p>
                <p>• Rute alternatif sudah dikirim ke Google Maps API</p>
                <p>• Unit terdekat: {selected.responders[0]} — jarak estimasi 1.2 km</p>
                {selected.type === "KECELAKAAN" && <p className="text-accent-red font-medium">⚠️ Deteksi airbag deployment dari metadata kendaraan</p>}
                {selected.type === "BURONAN" && <p className="text-accent-cyan font-medium">🔍 Plat nomor diteruskan ke database Polri real-time</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
