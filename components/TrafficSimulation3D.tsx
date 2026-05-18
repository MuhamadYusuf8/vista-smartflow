"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Road {
  id: string;
  name: string;
  x: number; y: number;
  width: number; height: number;
  isVertical: boolean;
  congestion: number; // 0-100
}

interface VehicleDot {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  roadId: string;
  color: string;
  flagged: boolean;
  size: number;
}

interface Hotspot {
  x: number; y: number;
  radius: number;
  intensity: number;
  label: string;
}

const ROADS: Road[] = [
  { id: "sudirman", name: "Sudirman", x: 200, y: 50, width: 30, height: 400, isVertical: true, congestion: 72 },
  { id: "thamrin", name: "Thamrin", x: 270, y: 50, width: 25, height: 350, isVertical: true, congestion: 85 },
  { id: "gatot", name: "Gatot Subroto", x: 50, y: 240, width: 500, height: 28, isVertical: false, congestion: 60 },
  { id: "rasuna", name: "Rasuna Said", x: 50, y: 310, width: 460, height: 24, isVertical: false, congestion: 45 },
  { id: "casablanca", name: "Casablanca", x: 50, y: 380, width: 480, height: 24, isVertical: false, congestion: 55 },
  { id: "bundaran-hi", name: "Bundaran HI", x: 240, y: 160, width: 80, height: 80, isVertical: false, congestion: 90 },
];

const HOTSPOTS: Hotspot[] = [
  { x: 280, y: 200, radius: 55, intensity: 0.9, label: "Bundaran HI" },
  { x: 215, y: 254, radius: 40, intensity: 0.72, label: "Semanggi" },
  { x: 400, y: 254, radius: 32, intensity: 0.6, label: "Gatot Subroto" },
  { x: 215, y: 310, radius: 35, intensity: 0.5, label: "Rasuna" },
];

function getCongestionColor(score: number, alpha = 1): string {
  if (score < 35) return `rgba(16, 185, 129, ${alpha})`;  // green
  if (score < 60) return `rgba(245, 158, 11, ${alpha})`;  // amber
  if (score < 80) return `rgba(249, 115, 22, ${alpha})`;  // orange
  return `rgba(239, 68, 68, ${alpha})`;                   // red
}

function generateVehicles(count: number): VehicleDot[] {
  const vehicles: VehicleDot[] = [];
  const roadPool = ROADS.filter((r) => r.id !== "bundaran-hi");

  for (let i = 0; i < count; i++) {
    const road = roadPool[i % roadPool.length];
    const isFlagged = Math.random() < 0.04;

    if (road.isVertical) {
      vehicles.push({
        id: `v${i}`,
        x: road.x + road.width * 0.25 + Math.random() * road.width * 0.5,
        y: road.y + Math.random() * road.height,
        vx: 0,
        vy: (1 + Math.random() * 2) * (Math.random() > 0.5 ? 1 : -1) * (1 - road.congestion / 150),
        roadId: road.id,
        color: isFlagged ? "#ef4444" : ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"][i % 4],
        flagged: isFlagged,
        size: 3 + Math.random() * 2,
      });
    } else {
      vehicles.push({
        id: `v${i}`,
        x: road.x + Math.random() * road.width,
        y: road.y + road.height * 0.25 + Math.random() * road.height * 0.5,
        vx: (1 + Math.random() * 2.5) * (Math.random() > 0.5 ? 1 : -1) * (1 - road.congestion / 150),
        vy: 0,
        roadId: road.id,
        color: isFlagged ? "#ef4444" : ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"][i % 4],
        flagged: isFlagged,
        size: 3 + Math.random() * 2,
      });
    }
  }
  return vehicles;
}

export default function TrafficSimulation3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vehiclesRef = useRef<VehicleDot[]>(generateVehicles(80));
  const animFrameRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [stats, setStats] = useState({ total: 80, flagged: 0, avgSpeed: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.fillStyle = "#0a1628";
    ctx.fillRect(0, 0, W, H);

    // Draw grid lines
    ctx.strokeStyle = "rgba(30, 42, 58, 0.8)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw hotspot halos
    HOTSPOTS.forEach((hs) => {
      const gradient = ctx.createRadialGradient(hs.x, hs.y, 0, hs.x, hs.y, hs.radius);
      gradient.addColorStop(0, `rgba(239, 68, 68, ${hs.intensity * 0.35})`);
      gradient.addColorStop(0.5, `rgba(239, 68, 68, ${hs.intensity * 0.15})`);
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.beginPath();
      ctx.arc(hs.x, hs.y, hs.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });

    // Draw roads
    ROADS.forEach((road) => {
      const color = getCongestionColor(road.congestion, 0.9);
      const glowColor = getCongestionColor(road.congestion, 0.35);

      // Road shadow/glow
      ctx.shadowBlur = 12;
      ctx.shadowColor = glowColor;

      // Road body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(road.x, road.y, road.width, road.height, 4);
      ctx.fill();

      ctx.shadowBlur = 0;

      // Road center divider lines
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      if (road.isVertical) {
        const cx = road.x + road.width / 2;
        ctx.beginPath();
        ctx.moveTo(cx, road.y);
        ctx.lineTo(cx, road.y + road.height);
        ctx.stroke();
      } else {
        const cy = road.y + road.height / 2;
        ctx.beginPath();
        ctx.moveTo(road.x, cy);
        ctx.lineTo(road.x + road.width, cy);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Road label
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      if (road.isVertical) {
        ctx.save();
        ctx.translate(road.x + road.width / 2, road.y + road.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(road.name, 0, 0);
        ctx.restore();
      } else if (road.id !== "bundaran-hi") {
        ctx.fillText(road.name, road.x + road.width / 2, road.y - 6);
      }
    });

    // Draw Bundaran HI circle
    const bhi = ROADS.find((r) => r.id === "bundaran-hi")!;
    const bhiCx = bhi.x + bhi.width / 2;
    const bhiCy = bhi.y + bhi.height / 2;
    ctx.beginPath();
    ctx.arc(bhiCx, bhiCy, bhi.width / 2, 0, Math.PI * 2);
    ctx.strokeStyle = getCongestionColor(bhi.congestion);
    ctx.lineWidth = 8;
    ctx.shadowBlur = 15;
    ctx.shadowColor = getCongestionColor(bhi.congestion, 0.6);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 8px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BHI", bhiCx, bhiCy + 3);

    // Update & draw vehicles
    let flaggedCount = 0;
    let totalSpeed = 0;

    vehiclesRef.current = vehiclesRef.current.map((v) => {
      const road = ROADS.find((r) => r.id === v.roadId)!;
      let { x, y, vx, vy } = v;

      x += vx;
      y += vy;

      // Bounce off road bounds
      if (road.isVertical) {
        if (y < road.y) { y = road.y; vy = Math.abs(vy); }
        if (y > road.y + road.height) { y = road.y + road.height; vy = -Math.abs(vy); }
      } else {
        if (x < road.x) { x = road.x; vx = Math.abs(vx); }
        if (x > road.x + road.width) { x = road.x + road.width; vx = -Math.abs(vx); }
      }

      // Draw vehicle
      ctx.beginPath();
      ctx.arc(x, y, v.size, 0, Math.PI * 2);
      ctx.fillStyle = v.color;
      ctx.shadowBlur = v.flagged ? 12 : 5;
      ctx.shadowColor = v.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Flagged ring
      if (v.flagged) {
        ctx.beginPath();
        ctx.arc(x, y, v.size + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        flaggedCount++;
      }

      totalSpeed += Math.sqrt(vx * vx + vy * vy);
      return { ...v, x, y, vx, vy };
    });

    setStats({
      total: vehiclesRef.current.length,
      flagged: flaggedCount,
      avgSpeed: Math.round((totalSpeed / vehiclesRef.current.length) * 15),
    });

    // CCTV camera dots
    HOTSPOTS.forEach((hs, i) => {
      ctx.beginPath();
      ctx.arc(hs.x, hs.y - hs.radius + 8, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#22d3ee";
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    if (isRunning) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
  }, [isRunning]);

  useEffect(() => {
    if (isRunning) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw, isRunning]);

  const resetSimulation = () => {
    vehiclesRef.current = generateVehicles(80);
  };

  return (
    <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-tertiary">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest">
            🗺 Digital Twin Jakarta
          </span>
          <span className="rounded-full bg-accent-green/10 border border-accent-green/20 px-2 py-0.5 text-[10px] font-semibold text-accent-green">
            LIVE SIM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={resetSimulation}
            className="p-1.5 rounded text-text-muted hover:text-white hover:bg-border transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsRunning((r) => !r)}
            className={cn(
              "p-1.5 rounded text-xs font-medium transition-colors",
              isRunning ? "text-accent-red hover:bg-border" : "text-accent-green hover:bg-border"
            )}
          >
            {isRunning ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={480}
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "100%", height: "100%" }}
          className="block"
        />

        {/* Legend */}
        <div className="absolute top-3 right-3 rounded-lg bg-bg-primary/90 border border-border p-3 text-xs space-y-1.5 backdrop-blur-sm">
          {[
            { color: "#10b981", label: "Lancar (<35)" },
            { color: "#f59e0b", label: "Padat (35-60)" },
            { color: "#f97316", label: "Macet (60-80)" },
            { color: "#ef4444", label: "Macet Total (>80)" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-text-muted">{item.label}</span>
            </div>
          ))}
          <div className="border-t border-border pt-1.5 mt-1">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-accent-cyan" />
              <span className="text-text-muted">Kamera CCTV</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-accent-red" />
              <span className="text-text-muted">Kendaraan Pantau</span>
            </div>
          </div>
        </div>

        {/* Stats overlay */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          {[
            { label: "Kendaraan", value: stats.total, color: "text-white" },
            { label: "Dipantau", value: stats.flagged, color: "text-accent-red" },
            { label: "~Kecepatan", value: `${stats.avgSpeed} km/h`, color: "text-accent-cyan" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-bg-primary/90 border border-border px-3 py-1.5 backdrop-blur-sm text-center">
              <p className="text-[10px] text-text-muted">{item.label}</p>
              <p className={cn("text-sm font-bold", item.color)}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
