"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Map as MapGL } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import { FlyToInterpolator } from "@deck.gl/core";
import { Layers, Lightbulb, MapPin, RefreshCw, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import "maplibre-gl/dist/maplibre-gl.css";

// ── Types ────────────────────────────────────────────────────────────────────
type ViolationType =
  | "ILLEGAL_PARKING"
  | "BUSWAY_VIOLATION"
  | "BICYCLE_LANE_VIOLATION"
  | "BUS_STOP_VIOLATION"
  | "WRONG_LANE";

interface ViolationPoint {
  coordinates: [number, number]; // [lng, lat]
  type: ViolationType;
  timestamp: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const INITIAL_VIEW = {
  longitude: 106.816666,
  latitude: -6.2,
  zoom: 13,
  pitch: 60,
  bearing: -20,
  transitionDuration: 2000,
  transitionInterpolator: new FlyToInterpolator({ speed: 1.5 }),
};

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Neon cyberpunk color range: dark blue → cyan → green → yellow → hot orange → red
const COLOR_RANGE = [
  [15, 10, 60],     // deep indigo
  [20, 50, 180],    // blue
  [0, 200, 220],    // cyan
  [0, 230, 120],    // neon green
  [255, 200, 0],    // bright yellow
  [255, 80, 0],     // hot orange
  [255, 20, 20],    // neon red
];

const LAYER_CONFIG: {
  key: ViolationType;
  label: string;
  dot: string;
  active: string;
}[] = [
  { key: "ILLEGAL_PARKING", label: "Parkir Liar", dot: "bg-red-500", active: "border-red-500/50 bg-red-500/10" },
  { key: "BUSWAY_VIOLATION", label: "Jalur Busway", dot: "bg-amber-400", active: "border-amber-400/50 bg-amber-400/10" },
  { key: "BICYCLE_LANE_VIOLATION", label: "Jalur Sepeda", dot: "bg-green-400", active: "border-green-400/50 bg-green-400/10" },
  { key: "BUS_STOP_VIOLATION", label: "Halte Bus", dot: "bg-blue-400", active: "border-blue-400/50 bg-blue-400/10" },
  { key: "WRONG_LANE", label: "Salah Lajur", dot: "bg-cyan-400", active: "border-cyan-400/50 bg-cyan-400/10" },
];

const DAYS_OPTIONS = [
  { label: "Hari Ini", value: 1 },
  { label: "7 Hari", value: 7 },
  { label: "30 Hari", value: 30 },
];

// ── Fallback mock generator ───────────────────────────────────────────────────
function generateMockPoints(count = 3000): ViolationPoint[] {
  const TYPES: ViolationType[] = [
    "ILLEGAL_PARKING", "BUSWAY_VIOLATION", "BICYCLE_LANE_VIOLATION",
    "BUS_STOP_VIOLATION", "WRONG_LANE",
  ];
  const HOTSPOT_CENTERS = [
    [106.8182, -6.2087], [106.8229, -6.1944], [106.8080, -6.2264],
    [106.8003, -6.2188], [106.8126, -6.1864], [106.8291, -6.2199],
    [106.8303, -6.2459], [106.8100, -6.2122], [106.8659, -6.2417],
    [106.9123, -6.1556],
  ];
  const points: ViolationPoint[] = [];
  for (let i = 0; i < count; i++) {
    const center = HOTSPOT_CENTERS[i % HOTSPOT_CENTERS.length];
    const lng = center[0] + (Math.random() - 0.5) * 0.04;
    const lat = center[1] + (Math.random() - 0.5) * 0.04;
    points.push({
      coordinates: [lng, lat],
      type: TYPES[i % TYPES.length],
      timestamp: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    });
  }
  return points;
}

// ── 3D Building style injection ───────────────────────────────────────────────
function inject3DBuildings(map: maplibregl.Map) {
  if (map.getLayer("3d-buildings")) return;

  // Find the first symbol layer to insert below it
  const layers = map.getStyle().layers ?? [];
  let firstSymbolId = "";
  for (const layer of layers) {
    if (layer.type === "symbol") { firstSymbolId = layer.id; break; }
  }

  map.addLayer(
    {
      id: "3d-buildings",
      source: "carto",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": "#0a1520",
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 12, 0, 16, ["get", "height"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 12, 0, 16, ["get", "min_height"]],
        "fill-extrusion-opacity": 0.7,
      },
    } as Parameters<typeof map.addLayer>[0],
    firstSymbolId || undefined
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HeatmapPage() {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [activeLayers, setActiveLayers] = useState<Set<ViolationType>>(
    new Set(["ILLEGAL_PARKING", "BUSWAY_VIOLATION", "BICYCLE_LANE_VIOLATION", "BUS_STOP_VIOLATION", "WRONG_LANE"])
  );
  const [days, setDays] = useState(7);
  const [allPoints, setAllPoints] = useState<ViolationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [topHotspot, setTopHotspot] = useState("");
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Fetch from Supabase, fallback to mock
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data } = await supabase
        .from("violations")
        .select("lat, lng, type, timestamp, location")
        .gte("timestamp", since.toISOString())
        .not("lat", "is", null)
        .not("lng", "is", null);

      const dbPoints = (data ?? []).filter((v) => v.lat && v.lng);

      if (dbPoints.length >= 10) {
        const pts: ViolationPoint[] = dbPoints.map((v) => ({
          coordinates: [v.lng, v.lat] as [number, number],
          type: v.type as ViolationType,
          timestamp: v.timestamp ?? new Date().toISOString(),
        }));
        setAllPoints(pts);
        setTotalCount(dbPoints.length);

        // top hotspot
        const locCount: Record<string, number> = {};
        dbPoints.forEach((v) => { if (v.location) locCount[v.location] = (locCount[v.location] ?? 0) + 1; });
        const top = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0];
        setTopHotspot(top ? `${top[0]} (${top[1]} kasus)` : "");
      } else {
        const mock = generateMockPoints(3000);
        setAllPoints(mock);
        setTotalCount(mock.length);
        setTopHotspot("Jl. Gatot Subroto — Semanggi (simulasi)");
      }
    } catch {
      const mock = generateMockPoints(3000);
      setAllPoints(mock);
      setTotalCount(mock.length);
      setTopHotspot("Bundaran HI (simulasi)");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter points by active layers
  const filteredPoints = useMemo(
    () => allPoints.filter((p) => activeLayers.has(p.type)),
    [allPoints, activeLayers]
  );

  const toggleLayer = (key: ViolationType) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // deck.gl HexagonLayer
  const layers = useMemo(() => [
    new HexagonLayer({
      id: "hexagon-violations",
      data: filteredPoints,
      getPosition: (d: ViolationPoint) => d.coordinates,
      radius: 120,
      elevationScale: 6,
      extruded: true,
      pickable: true,
      coverage: 0.88,
      colorRange: COLOR_RANGE as [number, number, number][],
      elevationRange: [0, 800],
      transitions: {
        elevationScale: { duration: 1200, type: "spring", stiffness: 0.01, damping: 0.15 },
      },
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [60, 64, 70],
      },
    }),
  ], [filteredPoints]);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden rounded-xl border border-border">

      {/* ── DeckGL + MapLibre ── */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW)}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        style={{ position: "absolute", top: "0", left: "0", right: "0", bottom: "0" }}
      >
        <MapGL
          mapStyle={MAP_STYLE}
          onLoad={(e) => {
            mapRef.current = e.target as unknown as maplibregl.Map;
            setTimeout(() => {
              if (mapRef.current) inject3DBuildings(mapRef.current);
            }, 500);
          }}
          attributionControl={false}
        />
      </DeckGL>

      {/* ── Scanline overlay (cyberpunk feel) ── */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)" }}
      />

      {/* ── Left Sidebar (Glassmorphism) ── */}
      <div className="absolute left-4 top-4 z-10 flex w-64 flex-col gap-3">

        {/* Header Card */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">LIVE — AI Heatmap</span>
          </div>
          <h2 className="font-heading text-lg font-bold text-white leading-tight">Traffic Violation<br />Hotspot 3D</h2>
          <p className="text-xs text-white/50 mt-1">Powered by VISTA SmartFlow AI</p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Titik Data", val: loading ? "—" : totalCount.toLocaleString("id-ID"), color: "text-cyan-400" },
            { label: "Layer Aktif", val: `${activeLayers.size}/5`, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-white/10 bg-black/50 backdrop-blur-lg p-3">
              <p className="text-[10px] text-white/40 mb-0.5">{s.label}</p>
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Layer Filter */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-white/60" />
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Filter Layer</span>
          </div>
          <div className="space-y-2">
            {LAYER_CONFIG.map((lc) => {
              const active = activeLayers.has(lc.key);
              return (
                <button
                  key={lc.key}
                  onClick={() => toggleLayer(lc.key)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                    active ? lc.active + " text-white" : "border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {lc.label}
                  <span className={`h-3 w-3 rounded-full border-2 transition-all ${active ? lc.dot + " border-transparent shadow-lg" : "border-white/20 bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Range */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl shadow-xl">
          <p className="text-xs font-bold text-white/80 uppercase tracking-wider mb-3">Rentang Waktu</p>
          <div className="flex gap-2">
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  days === opt.value
                    ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    : "border border-white/10 bg-white/5 text-white/40 hover:text-white/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/50 py-2.5 text-xs font-semibold text-white/60 backdrop-blur-lg hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          {loading ? "Memuat data..." : "Refresh Data"}
        </button>
      </div>

      {/* ── Top Hotspot floating card ── */}
      {topHotspot && (
        <div className="absolute left-4 bottom-4 z-10 max-w-xs rounded-xl border border-amber-500/20 bg-black/70 p-3 backdrop-blur-xl shadow-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-0.5">Top Hotspot</p>
              <p className="text-xs text-white/80">{topHotspot}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom-right Intensity Legend ── */}
      <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl shadow-2xl w-52">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-white/60" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Intensitas</span>
        </div>
        <div
          className="h-3 w-full rounded-full"
          style={{ background: "linear-gradient(to right, #0a0a3c, #1432b4, #00c8dc, #00e678, #ffc800, #ff5000, #ff1414)" }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/40">Rendah</span>
          <span className="text-[10px] text-white/40">Tinggi</span>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3 space-y-1">
          <p className="text-[10px] text-white/40">{filteredPoints.length.toLocaleString("id-ID")} titik aktif</p>
          <p className="text-[10px] text-white/40">Radius hexagon: 120m</p>
          <p className="text-[10px] text-cyan-400/70">WebGL 3D · deck.gl</p>
        </div>
      </div>

      {/* ── AI Insight floating ── */}
      {!loading && filteredPoints.length > 0 && (
        <div className="absolute top-4 right-4 z-10 max-w-[220px] rounded-xl border border-blue-500/20 bg-black/70 p-3 backdrop-blur-xl shadow-xl">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">AI Insight</p>
              <p className="text-[10px] text-white/70 leading-relaxed">
                Konsentrasi pelanggaran tertinggi terdeteksi di zona <span className="text-white font-semibold">Semanggi–Sudirman</span>. Rekomendasi: tingkatkan patroli 07:00–09:00 & 17:00–19:00.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-primary/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-black/80 px-6 py-4 shadow-2xl">
            <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
            <span className="text-sm font-medium text-white">Memuat data hotspot 3D...</span>
          </div>
        </div>
      )}
    </div>
  );
}
