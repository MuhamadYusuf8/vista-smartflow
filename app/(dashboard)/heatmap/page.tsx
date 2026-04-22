"use client";

import dynamic from "next/dynamic";
import { Layers, Lightbulb, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Dynamically import the leaflet component with SSR disabled
const HeatmapViewWrapper = dynamic(
  () => import("@/components/heatmap/HeatmapView"),
  { ssr: false, loading: () => <div className="h-full w-full bg-bg-secondary animate-pulse flex items-center justify-center text-text-muted">Memuat Peta...</div> }
);

// Mock points: [lat, lng, intensity]
const mockPoints: [number, number, number][] = Array.from({ length: 500 }).map(() => [
  -6.2 + (Math.random() - 0.5) * 0.15,
  106.8 + (Math.random() - 0.5) * 0.15,
  Math.random()
]);

const HOTSPOTS = [
  { name: "Jl. Jend. Sudirman KM 2", count: 142, type: "PARKIR LIAR" },
  { name: "Bundaran HI", count: 98, type: "BUSWAY" },
  { name: "Jl. MT Haryono", count: 87, type: "CAMPURAN" },
  { name: "Stasiun Tanah Abang", count: 85, type: "PARKIR LIAR" },
  { name: "Jl. MH Thamrin", count: 64, type: "CAMPURAN" }
];

export default function HeatmapPage() {
  const [activeLayers, setActiveLayers] = useState(["parkir", "busway"]);
  
  const toggleLayer = (layer: string) => {
    setActiveLayers(prev => 
      prev.includes(layer) 
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-6 lg:flex-row">
      {/* Sidebar Panel overlay-like concept but in grid */}
      <div className="flex h-full w-full flex-col gap-4 lg:w-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
        
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-accent-blue" />
            Filter Layer
          </h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => toggleLayer("parkir")}
              className={cn("flex w-full items-center justify-between rounded-lg border p-3 transition-all", activeLayers.includes("parkir") ? "border-accent-red bg-accent-red/10" : "border-border bg-bg-primary")}
            >
              <span className={cn("text-sm font-medium", activeLayers.includes("parkir") ? "text-white" : "text-text-secondary")}>Parkir Liar</span>
              <div className={cn("h-4 w-4 rounded-full border-2", activeLayers.includes("parkir") ? "border-accent-red bg-accent-red" : "border-border bg-transparent")} />
            </button>
            <button 
              onClick={() => toggleLayer("busway")}
              className={cn("flex w-full items-center justify-between rounded-lg border p-3 transition-all", activeLayers.includes("busway") ? "border-accent-amber bg-accent-amber/10" : "border-border bg-bg-primary")}
            >
              <span className={cn("text-sm font-medium", activeLayers.includes("busway") ? "text-white" : "text-text-secondary")}>Jalur Busway</span>
              <div className={cn("h-4 w-4 rounded-full border-2", activeLayers.includes("busway") ? "border-accent-amber bg-accent-amber" : "border-border bg-transparent")} />
            </button>
            <button 
              onClick={() => toggleLayer("sepeda")}
              className={cn("flex w-full items-center justify-between rounded-lg border p-3 transition-all", activeLayers.includes("sepeda") ? "border-accent-green bg-accent-green/10" : "border-border bg-bg-primary")}
            >
              <span className={cn("text-sm font-medium", activeLayers.includes("sepeda") ? "text-white" : "text-text-secondary")}>Jalur Sepeda</span>
              <div className={cn("h-4 w-4 rounded-full border-2", activeLayers.includes("sepeda") ? "border-accent-green bg-accent-green" : "border-border bg-transparent")} />
            </button>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-medium text-text-secondary mb-3">Rentang Waktu</h3>
            <select className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent-blue">
              <option>Hari Ini</option>
              <option>7 Hari Terakhir</option>
              <option>30 Hari Terakhir</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-secondary p-5 flex-1 flex flex-col min-h-[300px]">
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-accent-red" />
            Top 5 Hotspot
          </h2>
          <div className="flex-1 space-y-3">
            {HOTSPOTS.map((spot, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-white">{spot.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{spot.type}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded bg-bg-tertiary">
                  <span className="text-xs font-bold text-accent-cyan">{spot.count}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg bg-accent-blue/10 border border-accent-blue/20 p-3 flex gap-3 items-start">
            <Lightbulb className="h-5 w-5 text-accent-blue shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">
              <span className="font-semibold block mb-1">Rekomendasi Penempatan Petugas:</span>
              Berdasarkan data minggu ini, patroli di Jl. Jend. Sudirman KM 2 sangat disarankan pada pk 08:00 - 10:00.
            </p>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border">
        <HeatmapViewWrapper points={mockPoints} />

        {/* Floating Legend */}
        <div className="absolute bottom-6 right-6 z-[400] rounded-lg border border-border bg-bg-secondary/90 p-4 shadow-xl backdrop-blur-md">
          <h4 className="mb-2 text-xs font-bold text-white uppercase tracking-wider">Intensitas</h4>
          <div className="flex w-48 flex-col gap-1">
            <div className="h-3 w-full rounded-sm bg-gradient-to-r from-blue-500 via-lime-400 to-red-500"></div>
            <div className="flex justify-between text-[10px] text-text-muted font-medium">
              <span>Rendah</span>
              <span>Tinggi</span>
            </div>
          </div>
        </div>
        
        {/* Floating Search Bar */}
        <div className="absolute top-6 left-6 z-[400]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Cari lokasi kamera..."
              className="w-64 rounded-full border border-border bg-bg-secondary/90 py-2.5 pl-9 pr-4 text-sm text-white shadow-lg backdrop-blur-md placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/50 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
