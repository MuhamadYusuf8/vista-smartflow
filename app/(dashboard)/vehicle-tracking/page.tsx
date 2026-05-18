"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, MapPin, Clock, Camera, AlertTriangle,
  CheckCircle2, RefreshCw, Eye, Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Sighting {
  id: string;
  camera: { id: string; name: string; lat: number; lng: number; area: string };
  timestamp: string;
  confidence: number;
  direction: string;
  speed_kmh: number;
  isFlag: boolean;
}

interface TrackingResult {
  plate: string;
  found: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  trackingHistory: Sighting[];
  summary: {
    totalSightings: number;
    firstSeen: string;
    lastSeen: string;
    lastCamera: string;
    lastArea: string;
    trackingDurationMin: number;
    estimatedRouteKm: number;
  };
}

interface FlaggedVehicle {
  plate: string;
  lastCamera: string;
  lastArea?: string;
  lastSeen: string;
  totalSightings: number;
  isFlagged: boolean;
  flagReason: string;
}

export default function VehicleTrackingPage() {
  const [plate, setPlate] = useState("");
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [flaggedVehicles, setFlaggedVehicles] = useState<FlaggedVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const fetchFlaggedList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/vehicle-tracking?flagged=true");
      const json = await res.json();
      setFlaggedVehicles(json.trackedVehicles ?? []);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlaggedList();
    const interval = setInterval(fetchFlaggedList, 30000);
    return () => clearInterval(interval);
  }, [fetchFlaggedList]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setLoading(true);
    setTracking(null);
    try {
      const res = await fetch(`/api/vehicle-tracking?plate=${encodeURIComponent(plate.trim())}`);
      const json = await res.json();
      setTracking(json);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlagged = (p: string) => {
    setPlate(p);
    const form = document.getElementById("tracking-form") as HTMLFormElement;
    if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
          <Route className="h-7 w-7 text-accent-blue" />
          Vehicle Tracking Lintas Kamera
        </h1>
        <p className="text-sm text-text-muted">
          Lacak pergerakan kendaraan melewati jaringan CCTV VISTA SmartFlow AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search */}
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-accent-blue" />
              Cari Kendaraan
            </h2>
            <form id="tracking-form" onSubmit={handleSearch} className="space-y-3">
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="Plat nomor (e.g. B 1234 CD)"
                className="w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm font-mono text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !plate.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Lacak Kendaraan
              </button>
            </form>
          </div>

          {/* Flagged Vehicles */}
          <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                Kendaraan Pantau
              </span>
              <span className="rounded-full bg-accent-red/10 border border-accent-red/20 px-2 py-0.5 text-xs font-medium text-accent-red">
                {flaggedVehicles.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {listLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="h-4 w-32 bg-bg-tertiary rounded mb-2" />
                      <div className="h-3 w-48 bg-bg-tertiary rounded" />
                    </div>
                  ))
                : flaggedVehicles.map((v) => (
                    <button
                      key={v.plate}
                      onClick={() => handleSelectFlagged(v.plate)}
                      className="w-full px-4 py-3 text-left hover:bg-bg-tertiary transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-sm font-bold text-accent-red">{v.plate}</span>
                        <AlertTriangle className="h-4 w-4 text-accent-red" />
                      </div>
                      <p className="text-xs text-text-muted">
                        {v.totalSightings} sighting · Terakhir: {v.lastArea ?? v.lastCamera}
                      </p>
                    </button>
                  ))}
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-2 space-y-4">
          {!tracking && !loading && (
            <div className="rounded-xl border border-border bg-bg-secondary p-16 text-center">
              <Route className="h-12 w-12 text-text-muted mx-auto mb-4 opacity-30" />
              <p className="text-text-muted">Masukkan plat nomor untuk melacak pergerakan kendaraan</p>
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-bg-secondary p-16 text-center">
              <RefreshCw className="h-10 w-10 text-accent-blue mx-auto mb-4 animate-spin" />
              <p className="text-text-muted">Mencari di 6 kamera CCTV aktif...</p>
            </div>
          )}

          {tracking && (
            <>
              {/* Summary */}
              <div className={cn(
                "rounded-xl border-2 p-5",
                tracking.isFlagged
                  ? "border-accent-red/50 bg-accent-red/10"
                  : "border-accent-green/30 bg-accent-green/5"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold text-white">{tracking.plate}</span>
                      {tracking.isFlagged && (
                        <span className="rounded-full bg-accent-red/20 border border-accent-red/30 px-2.5 py-1 text-xs font-bold text-accent-red">
                          ⚠️ PANTAU
                        </span>
                      )}
                    </div>
                    {tracking.isFlagged && (
                      <p className="text-sm text-accent-red mt-1">{tracking.flagReason}</p>
                    )}
                  </div>
                  {!tracking.isFlagged && (
                    <CheckCircle2 className="h-8 w-8 text-accent-green" />
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Sighting", value: tracking.summary.totalSightings },
                    { label: "Durasi Pelacakan", value: `${tracking.summary.trackingDurationMin} menit` },
                    { label: "Estimasi Jarak", value: `${tracking.summary.estimatedRouteKm} km` },
                    { label: "Posisi Terakhir", value: tracking.summary.lastArea },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-bg-tertiary/80 p-3">
                      <p className="text-xs text-text-muted">{item.label}</p>
                      <p className="text-sm font-bold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-bg-tertiary">
                  <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Timeline Pergerakan ({tracking.trackingHistory.length} deteksi)
                  </h2>
                </div>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="divide-y divide-border">
                    {tracking.trackingHistory.map((sighting, idx) => (
                      <div key={sighting.id} className="flex gap-4 px-5 py-4 hover:bg-bg-tertiary/40 transition-colors">
                        {/* Step indicator */}
                        <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 bg-bg-primary ml-2"
                          style={{ borderColor: sighting.isFlag ? "#ef4444" : "#3b82f6" }}>
                          <span className="text-xs font-bold" style={{ color: sighting.isFlag ? "#ef4444" : "#3b82f6" }}>
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-white text-sm flex items-center gap-2">
                              <Camera className="h-4 w-4 text-text-muted" />
                              {sighting.camera.name}
                            </p>
                            {sighting.isFlag && (
                              <span className="text-xs text-accent-red font-bold">⚠️ TERDETEKSI</span>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(sighting.timestamp), "HH:mm:ss", { locale: idLocale })}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {sighting.camera.area}
                            </span>
                            <span>Arah: {sighting.direction}</span>
                            <span>{sighting.speed_kmh} km/h</span>
                            <span>Akurasi: {(sighting.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
