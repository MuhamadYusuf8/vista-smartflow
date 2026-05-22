"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, ZoomIn, ZoomOut, Play, Pause, AlertTriangle, CheckCircle, Minus, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Road {
  id: string;
  name: string;
  shortName: string;
  x: number; y: number;
  width: number; height: number;
  isVertical: boolean;
  congestion: number;
}

interface Vehicle {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  roadId: string;
  color: string;
  flagged: boolean;
  size: number;
  plateLabel?: string;
}

interface Incident {
  id: string;
  location: string;
  type: string;
  plate: string;
  time: string;
  severity: "critical" | "warning" | "info";
}

// ─── Road Network Data ────────────────────────────────────────────────────────

const ROADS: Road[] = [
  { id: "sudirman", name: "Jl. Sudirman", shortName: "Sudirman", x: 195, y: 40, width: 30, height: 380, isVertical: true, congestion: 72 },
  { id: "thamrin", name: "Jl. MH Thamrin", shortName: "Thamrin", x: 265, y: 40, width: 25, height: 340, isVertical: true, congestion: 85 },
  { id: "gatot", name: "Jl. Gatot Subroto", shortName: "Gatot Sub.", x: 40, y: 232, width: 500, height: 28, isVertical: false, congestion: 60 },
  { id: "rasuna", name: "Jl. Rasuna Said", shortName: "Rasuna", x: 40, y: 300, width: 460, height: 24, isVertical: false, congestion: 45 },
  { id: "casablanca", name: "Jl. Casablanca", shortName: "Casablanca", x: 40, y: 368, width: 480, height: 24, isVertical: false, congestion: 55 },
  { id: "bhi", name: "Bundaran HI", shortName: "BHI", x: 235, y: 155, width: 80, height: 80, isVertical: false, congestion: 90 },
];

const CCTV_POINTS = [
  { x: 275, y: 175, label: "CAM-01" },
  { x: 210, y: 246, label: "CAM-02" },
  { x: 390, y: 246, label: "CAM-03" },
  { x: 210, y: 314, label: "CAM-04" },
];

const MOCK_INCIDENTS: Incident[] = [
  { id: "i1", location: "Bundaran HI", type: "Pelanggaran Busway", plate: "B 1234 ABC", time: "16:42", severity: "critical" },
  { id: "i2", location: "Gatot Subroto", type: "Parkir Liar", plate: "B 5678 XYZ", time: "16:38", severity: "warning" },
  { id: "i3", location: "Jl. Thamrin", type: "Ganjil-Genap", plate: "B 9012 DEF", time: "16:31", severity: "critical" },
  { id: "i4", location: "Rasuna Said", type: "Pelanggaran Jalur Sepeda", plate: "B 3456 GHI", time: "16:25", severity: "warning" },
  { id: "i5", location: "Casablanca", type: "Kecepatan Berlebih", plate: "B 7890 JKL", time: "16:18", severity: "info" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function congestionColor(score: number, alpha = 1): string {
  if (score < 35) return `rgba(16,185,129,${alpha})`;
  if (score < 60) return `rgba(245,158,11,${alpha})`;
  if (score < 80) return `rgba(249,115,22,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

function congestionLabel(score: number): { label: string; cls: string } {
  if (score < 35) return { label: "LANCAR", cls: "text-emerald-400" };
  if (score < 60) return { label: "PADAT", cls: "text-amber-400" };
  if (score < 80) return { label: "MACET", cls: "text-orange-400" };
  return { label: "MACET TOTAL", cls: "text-red-400" };
}

function severityStyle(s: Incident["severity"]) {
  if (s === "critical") return { dot: "bg-red-500", badge: "bg-red-500/15 text-red-400 border-red-500/30" };
  if (s === "warning") return { dot: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
  return { dot: "bg-sky-400", badge: "bg-sky-400/15 text-sky-400 border-sky-400/30" };
}

function spawnVehicles(count: number): Vehicle[] {
  const pool = ROADS.filter(r => r.id !== "bhi");
  return Array.from({ length: count }, (_, i) => {
    const road = pool[i % pool.length];
    const flagged = Math.random() < 0.05;
    const base = flagged ? "#ef4444" : ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"][i % 4];
    const speed = (0.6 + Math.random() * 2) * (1 - road.congestion / 160);
    return road.isVertical
      ? { id: `v${i}`, x: road.x + road.width * 0.2 + Math.random() * road.width * 0.6, y: road.y + Math.random() * road.height, vx: 0, vy: speed * (Math.random() > .5 ? 1 : -1), roadId: road.id, color: base, flagged, size: 2.5 + Math.random() * 2, plateLabel: flagged ? `B ${1000 + i} XX` : undefined }
      : { id: `v${i}`, x: road.x + Math.random() * road.width, y: road.y + road.height * 0.2 + Math.random() * road.height * 0.6, vx: speed * (Math.random() > .5 ? 1 : -1), vy: 0, roadId: road.id, color: base, flagged, size: 2.5 + Math.random() * 2, plateLabel: flagged ? `B ${1000 + i} XX` : undefined };
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrafficSimulation3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vehiclesRef = useRef<Vehicle[]>(spawnVehicles(80));
  const rafRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);
  const [running, setRunning] = useState(true);
  const [stats, setStats] = useState({ total: 80, flagged: 0, speed: 0 });
  const [incidents] = useState<Incident[]>(MOCK_INCIDENTS);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);
  const [tick, setTick] = useState(0);

  // ── Canvas draw loop ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;

    // Background
    ctx.fillStyle = "#080f1c";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(30,42,58,0.6)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Hotspot halos
    [[275, 175, 60, 0.9], [210, 246, 45, 0.72], [210, 314, 38, 0.5]].forEach(([hx, hy, r, intensity]) => {
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
      g.addColorStop(0, `rgba(239,68,68,${intensity * 0.3})`);
      g.addColorStop(1, "rgba(239,68,68,0)");
      ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    });

    // Roads
    ROADS.forEach(road => {
      const isSelected = selectedRoad?.id === road.id;
      ctx.shadowBlur = isSelected ? 20 : 10;
      ctx.shadowColor = isSelected ? "#22d3ee" : congestionColor(road.congestion, 0.5);
      ctx.fillStyle = isSelected ? "#22d3ee" : congestionColor(road.congestion, 0.85);
      ctx.beginPath(); ctx.roundRect(road.x, road.y, road.width, road.height, 4); ctx.fill();
      ctx.shadowBlur = 0;

      // Center line
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      if (road.isVertical) {
        const cx = road.x + road.width / 2;
        ctx.beginPath(); ctx.moveTo(cx, road.y); ctx.lineTo(cx, road.y + road.height); ctx.stroke();
      } else if (road.id !== "bhi") {
        const cy = road.y + road.height / 2;
        ctx.beginPath(); ctx.moveTo(road.x, cy); ctx.lineTo(road.x + road.width, cy); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "bold 8px Inter,sans-serif"; ctx.textAlign = "center";
      if (road.id === "bhi") return;
      if (road.isVertical) {
        ctx.save(); ctx.translate(road.x + road.width / 2, road.y + road.height / 2);
        ctx.rotate(-Math.PI / 2); ctx.fillText(road.shortName, 0, 0); ctx.restore();
      } else {
        ctx.fillText(road.shortName, road.x + road.width / 2, road.y - 5);
      }
    });

    // BHI circle
    const bhi = ROADS.find(r => r.id === "bhi")!;
    const cx = bhi.x + bhi.width / 2, cy = bhi.y + bhi.height / 2;
    ctx.beginPath(); ctx.arc(cx, cy, bhi.width / 2, 0, Math.PI * 2);
    ctx.strokeStyle = congestionColor(bhi.congestion); ctx.lineWidth = 8;
    ctx.shadowBlur = 18; ctx.shadowColor = congestionColor(bhi.congestion, 0.7); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(8,15,28,0.6)"; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.font = "bold 9px Inter,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Bundaran HI", cx, cy - 2); ctx.fillText(`${bhi.congestion}% macet`, cx, cy + 10);

    // Vehicles
    let flaggedCount = 0, totalSpd = 0;
    vehiclesRef.current = vehiclesRef.current.map(v => {
      const road = ROADS.find(r => r.id === v.roadId)!;
      let { x, y, vx, vy } = v;
      x += vx; y += vy;
      if (road.isVertical) {
        if (y < road.y) { y = road.y; vy = Math.abs(vy); }
        if (y > road.y + road.height) { y = road.y + road.height; vy = -Math.abs(vy); }
      } else {
        if (x < road.x) { x = road.x; vx = Math.abs(vx); }
        if (x > road.x + road.width) { x = road.x + road.width; vx = -Math.abs(vx); }
      }
      ctx.beginPath(); ctx.arc(x, y, v.size, 0, Math.PI * 2);
      ctx.fillStyle = v.color; ctx.shadowBlur = v.flagged ? 14 : 4; ctx.shadowColor = v.color; ctx.fill(); ctx.shadowBlur = 0;
      if (v.flagged) {
        ctx.beginPath(); ctx.arc(x, y, v.size + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239,68,68,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
        flaggedCount++;
      }
      totalSpd += Math.sqrt(vx * vx + vy * vy);
      return { ...v, x, y, vx, vy };
    });

    // CCTV dots
    CCTV_POINTS.forEach(cam => {
      ctx.beginPath(); ctx.arc(cam.x, cam.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22d3ee"; ctx.shadowBlur = 10; ctx.shadowColor = "#22d3ee"; ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(34,211,238,0.7)"; ctx.font = "bold 7px Inter,sans-serif"; ctx.textAlign = "center";
      ctx.fillText(cam.label, cam.x, cam.y - 8);
    });

    // Scan line animation
    const scanY = ((Date.now() / 20) % H);
    const scanG = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
    scanG.addColorStop(0, "rgba(34,211,238,0)");
    scanG.addColorStop(0.5, "rgba(34,211,238,0.04)");
    scanG.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = scanG; ctx.fillRect(0, scanY - 30, W, 60);

    const n = vehiclesRef.current.length;
    setStats({ total: n, flagged: flaggedCount, speed: Math.round((totalSpd / n) * 16) });
    setTick(t => t + 1);
    if (running) rafRef.current = requestAnimationFrame(draw);
  }, [running, selectedRoad]);

  useEffect(() => {
    if (running) rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, running]);

  const reset = () => { vehiclesRef.current = spawnVehicles(80); };

  return (
    <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden h-full flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-bg-tertiary shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest">🗺 Digital Twin Jakarta</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold border",
            running
              ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          )}>
            {running ? "● LIVE" : "⏸ PAUSED"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} title="Perbesar" className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Perkecil" className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"><ZoomOut className="h-3.5 w-3.5" /></button>
          <button onClick={reset} title="Reset Simulasi" className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
          <button onClick={() => setRunning(r => !r)} title={running ? "Pause" : "Play"}
            className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
              running ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
            )}>
            {running ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Play</>}
          </button>
        </div>
      </div>

      {/* ── Body: 2-panel layout ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* LEFT: Canvas Map */}
        <div className="flex-1 relative overflow-hidden bg-[#080f1c]">
          <canvas
            ref={canvasRef}
            width={600} height={480}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "100%", height: "100%" }}
            className="block cursor-crosshair"
          />

          {/* ── Stats overlay (bottom-left) ── */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {[
              { label: "Kendaraan", value: stats.total, color: "text-white" },
              { label: "Dipantau", value: stats.flagged, color: "text-red-400 font-bold" },
              { label: "Kec. Rata²", value: `${stats.speed} km/h`, color: "text-sky-400" },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-bg-primary/90 border border-border px-3 py-1.5 backdrop-blur-sm text-center">
                <p className="text-[10px] text-text-muted">{item.label}</p>
                <p className={cn("text-sm font-bold", item.color)}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* ── Legend (top-right of canvas) ── */}
          <div className="absolute top-3 right-3 rounded-lg bg-bg-primary/90 border border-border p-2.5 text-[10px] space-y-1.5 backdrop-blur-sm">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Status Jalan</p>
            {[
              { color: "#10b981", label: "Lancar (<35)" },
              { color: "#f59e0b", label: "Padat (35-60)" },
              { color: "#f97316", label: "Macet (60-80)" },
              { color: "#ef4444", label: "Macet Total (>80)" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="h-2 w-4 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-text-muted">{item.label}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 mt-1 space-y-1.5">
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-sky-400 shrink-0" /><span className="text-text-muted">Kamera CCTV</span></div>
              <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-red-500 ring-1 ring-red-400 shrink-0" /><span className="text-text-muted">Kendaraan Dipantau</span></div>
            </div>
          </div>
        </div>

        {/* RIGHT: Command Panel */}
        <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-hidden bg-bg-tertiary">

          {/* Status Ruas Jalan */}
          <div className="p-3 border-b border-border shrink-0">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">📍 Status Ruas Jalan</p>
            <div className="space-y-1.5">
              {ROADS.filter(r => r.id !== "bhi").map(road => {
                const { label, cls } = congestionLabel(road.congestion);
                const isSelected = selectedRoad?.id === road.id;
                return (
                  <button
                    key={road.id}
                    onClick={() => setSelectedRoad(isSelected ? null : road)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors text-left",
                      isSelected ? "bg-accent-cyan/15 border border-accent-cyan/40" : "bg-bg-secondary/60 hover:bg-bg-secondary border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Eye className={cn("h-3 w-3 shrink-0", isSelected ? "text-accent-cyan" : "text-text-muted")} />
                      <span className="text-xs text-white truncate">{road.shortName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-text-muted">{road.congestion}%</span>
                      <span className={cn("text-[9px] font-bold", cls)}>{label}</span>
                    </div>
                  </button>
                );
              })}
              {/* BHI special */}
              {(() => {
                const bhi = ROADS.find(r => r.id === "bhi")!; const { label, cls } = congestionLabel(bhi.congestion); return (
                  <div className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/30 px-2.5 py-2">
                    <div className="flex items-center gap-2"><span className="text-xs text-white">Bundaran HI</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted">{bhi.congestion}%</span>
                      <span className={cn("text-[9px] font-bold", cls)}>{label}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Insiden Aktif */}
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">🚨 Insiden Aktif</p>
              <span className="rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 border border-red-500/30">
                {incidents.filter(i => i.severity === "critical").length} Kritis
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ scrollbarWidth: "thin" }}>
              {incidents.map(inc => {
                const st = severityStyle(inc.severity);
                return (
                  <div key={inc.id} className={cn("rounded-lg p-2.5 border", inc.severity === "critical" ? "bg-red-500/8 border-red-500/25" : inc.severity === "warning" ? "bg-amber-400/8 border-amber-400/25" : "bg-sky-400/8 border-sky-400/25")}>
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-0.5", st.dot)} />
                        <span className="text-[10px] font-bold text-white leading-tight">{inc.type}</span>
                      </div>
                      <span className="text-[9px] text-text-muted shrink-0">{inc.time}</span>
                    </div>
                    <p className="text-[10px] text-text-muted ml-3">{inc.location}</p>
                    <div className="ml-3 mt-1">
                      <span className={cn("text-[9px] font-mono font-bold rounded px-1 py-0.5 border", st.badge)}>{inc.plate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom summary */}
          <div className="border-t border-border p-3 shrink-0">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[9px] text-text-muted">Lancar</p>
                <p className="text-sm font-bold text-emerald-400">{ROADS.filter(r => r.congestion < 35).length}</p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted">Macet</p>
                <p className="text-sm font-bold text-orange-400">{ROADS.filter(r => r.congestion >= 60 && r.congestion < 80).length}</p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted">Kritis</p>
                <p className="text-sm font-bold text-red-400">{ROADS.filter(r => r.congestion >= 80).length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
