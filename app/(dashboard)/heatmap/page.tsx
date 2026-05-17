"use client";

import dynamic from "next/dynamic";
import { Layers, Lightbulb, MapPin, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const HeatmapViewWrapper = dynamic(
  () => import("@/components/heatmap/HeatmapView"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-bg-secondary animate-pulse flex items-center justify-center text-text-muted">
        Memuat Peta...
      </div>
    ),
  }
);

type LayerKey = "parkir" | "busway" | "sepeda" | "halte" | "lajur";

const LAYER_MAP: Record<LayerKey, string> = {
  parkir: "ILLEGAL_PARKING",
  busway: "BUSWAY_VIOLATION",
  sepeda: "BICYCLE_LANE_VIOLATION",
  halte: "BUS_STOP_VIOLATION",
  lajur: "WRONG_LANE",
};

const LAYER_CONFIG: {
  key: LayerKey;
  label: string;
  colorClass: string;
  activeClass: string;
}[] = [
  { key: "parkir", label: "Parkir Liar", colorClass: "border-accent-red bg-accent-red", activeClass: "border-accent-red bg-accent-red/10" },
  { key: "busway", label: "Jalur Busway", colorClass: "border-accent-amber bg-accent-amber", activeClass: "border-accent-amber bg-accent-amber/10" },
  { key: "sepeda", label: "Jalur Sepeda", colorClass: "border-accent-green bg-accent-green", activeClass: "border-accent-green bg-accent-green/10" },
  { key: "halte", label: "Halte Bus", colorClass: "border-accent-blue bg-accent-blue", activeClass: "border-accent-blue bg-accent-blue/10" },
  { key: "lajur", label: "Salah Lajur", colorClass: "border-accent-cyan bg-accent-cyan", activeClass: "border-accent-cyan bg-accent-cyan/10" },
];

const DAYS_OPTIONS = [
  { label: "Hari Ini", value: 1 },
  { label: "7 Hari Terakhir", value: 7 },
  { label: "30 Hari Terakhir", value: 30 },
];

interface HotspotData {
  location: string;
  count: number;
  type: string;
}

export default function HeatmapPage() {
  const [activeLayers, setActiveLayers] = useState<LayerKey[]>(["parkir", "busway", "sepeda", "halte", "lajur"]);
  const [days, setDays] = useState(7);
  const [points, setPoints] = useState<[number, number, number][]>([]);
  const [hotspots, setHotspots] = useState<HotspotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string>("");

  const toggleLayer = (layer: LayerKey) => {
    setActiveLayers((prev) =>
      prev.includes(layer) ? prev.filter((l) => l !== layer) : [...prev, layer]
    );
  };

  const fetchHeatmapData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Build type filter from active layers
      const activeTypes = activeLayers.map((l) => LAYER_MAP[l]);

      let query = supabase
        .from("violations")
        .select("lat, lng, type, location, timestamp")
        .gte("timestamp", startDate.toISOString())
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (activeTypes.length > 0 && activeTypes.length < 5) {
        query = query.in("type", activeTypes);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allPoints: [number, number, number][] = (data ?? []).map((v) => [
        v.lat,
        v.lng,
        0.5 + Math.random() * 0.5, // intensity
      ]);
      setPoints(allPoints);

      // Compute hotspots by location
      const locationMap: Record<string, { count: number; type: string }> = {};
      (data ?? []).forEach((v) => {
        const key = v.location ?? "Lokasi Tidak Diketahui";
        if (!locationMap[key]) locationMap[key] = { count: 0, type: v.type };
        locationMap[key].count++;
      });

      const hotspotList: HotspotData[] = Object.entries(locationMap)
        .map(([location, info]) => ({ location, count: info.count, type: info.type }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setHotspots(hotspotList);

      // Generate AI insight from data
      if (hotspotList.length > 0) {
        const topSpot = hotspotList[0];
        const typeLabel: Record<string, string> = {
          ILLEGAL_PARKING: "Parkir Liar",
          BUSWAY_VIOLATION: "Busway",
          BICYCLE_LANE_VIOLATION: "Jalur Sepeda",
          BUS_STOP_VIOLATION: "Halte Bus",
          WRONG_LANE: "Salah Lajur",
        };
        setAiInsight(
          `Berdasarkan data ${days === 1 ? "hari ini" : `${days} hari terakhir`}, lokasi "${topSpot.location}" memiliki konsentrasi pelanggaran tertinggi (${topSpot.count} kasus, dominan: ${typeLabel[topSpot.type] ?? topSpot.type}). Penempatan petugas di area ini sangat dianjurkan.`
        );
      } else {
        setAiInsight("Tidak cukup data untuk menghasilkan rekomendasi AI pada periode ini.");
      }
    } catch (err) {
      console.error("Heatmap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeLayers, days]);

  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  const typeLabel: Record<string, string> = {
    ILLEGAL_PARKING: "Parkir Liar",
    BUSWAY_VIOLATION: "Busway",
    BICYCLE_LANE_VIOLATION: "Jalur Sepeda",
    BUS_STOP_VIOLATION: "Halte Bus",
    WRONG_LANE: "Salah Lajur",
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 lg:flex-row">
      {/* Sidebar Panel */}
      <div className="flex h-full w-full flex-col gap-4 lg:w-80 overflow-y-auto pr-2">

        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-accent-blue" />
            Filter Layer
          </h2>

          <div className="space-y-3">
            {LAYER_CONFIG.map((layer) => (
              <button
                key={layer.key}
                onClick={() => toggleLayer(layer.key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 transition-all",
                  activeLayers.includes(layer.key)
                    ? layer.activeClass
                    : "border-border bg-bg-primary"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    activeLayers.includes(layer.key) ? "text-white" : "text-text-secondary"
                  )}
                >
                  {layer.label}
                </span>
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-colors",
                    activeLayers.includes(layer.key)
                      ? layer.colorClass
                      : "border-border bg-transparent"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-medium text-text-secondary mb-3">Rentang Waktu</h3>
            <div className="flex flex-col gap-2">
              {DAYS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                    days === opt.value
                      ? "border-accent-blue bg-accent-blue/10 text-white font-medium"
                      : "border-border bg-bg-primary text-text-secondary hover:bg-bg-tertiary hover:text-white"
                  )}
                >
                  {opt.label}
                  {days === opt.value && (
                    <span className="h-2 w-2 rounded-full bg-accent-blue" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-text-muted border-t border-border pt-4">
            <span>{loading ? "Memuat data..." : `${points.length} titik pelanggaran`}</span>
            <button
              onClick={fetchHeatmapData}
              disabled={loading}
              className="flex items-center gap-1 text-accent-blue hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Top Hotspots */}
        <div className="rounded-xl border border-border bg-bg-secondary p-5 flex-1 flex flex-col min-h-[300px]">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-accent-red" />
            Top {hotspots.length} Hotspot
          </h2>
          <div className="flex-1 space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0 animate-pulse">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-40 rounded bg-bg-tertiary" />
                    <div className="h-3 w-24 rounded bg-bg-tertiary" />
                  </div>
                  <div className="h-8 w-8 rounded bg-bg-tertiary" />
                </div>
              ))
            ) : hotspots.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-sm text-text-muted">
                <div>
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>Tidak ada data hotspot</p>
                  <p className="text-xs mt-1">Ubah filter atau rentang waktu</p>
                </div>
              </div>
            ) : (
              hotspots.map((spot, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{spot.location}</p>
                    <p className="text-xs text-text-muted mt-0.5">{typeLabel[spot.type] ?? spot.type}</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-tertiary shrink-0">
                    <span className="text-xs font-bold text-accent-cyan">{spot.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {aiInsight && (
            <div className="mt-4 rounded-lg bg-accent-blue/10 border border-accent-blue/20 p-3 flex gap-3 items-start">
              <Lightbulb className="h-5 w-5 text-accent-blue shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200">
                <span className="font-semibold block mb-1">Rekomendasi AI:</span>
                {aiInsight}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border">
        <HeatmapViewWrapper points={points} />

        {/* Floating Legend */}
        <div className="absolute bottom-6 right-6 z-[400] rounded-lg border border-border bg-bg-secondary/90 p-4 shadow-xl backdrop-blur-md">
          <h4 className="mb-2 text-xs font-bold text-white uppercase tracking-wider">Intensitas</h4>
          <div className="flex w-48 flex-col gap-1">
            <div className="h-3 w-full rounded-sm bg-gradient-to-r from-blue-500 via-lime-400 to-red-500" />
            <div className="flex justify-between text-[10px] text-text-muted font-medium">
              <span>Rendah</span>
              <span>Tinggi</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-text-muted">
            {points.length} titik • {days === 1 ? "Hari ini" : `${days} hari`}
          </p>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-bg-primary/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary px-6 py-4 shadow-2xl">
              <RefreshCw className="h-5 w-5 text-accent-blue animate-spin" />
              <span className="text-sm font-medium text-white">Memuat data hotspot...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
