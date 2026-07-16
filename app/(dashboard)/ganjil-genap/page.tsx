"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Car, Clock, Shield, MapPin, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Calendar, Info, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const GANJIL_GENAP_PAD_PER_VIOLATION = 500_000; // Rp 500.000 denda


interface GanjilGenapResponse {
  policy: {
    isEnforced: boolean;
    isHoliday: boolean;
    day: string;
    date: number;
    dateIsOdd: boolean;
    restrictedPlate: "GANJIL" | "GENAP" | null;
    activeSession: "pagi" | "sore" | null;
    nextSession: { label: string; minutesUntil: number } | null;
    sessions: { label: string; start: string; end: string }[];
  };
  zones: Array<{ id: string; name: string; description: string; lat: number; lng: number }>;
  stats: { totalZones: number; kmCoverage: number };
  plateCheck?: {
    plate: string;
    lastDigit: number;
    plateIsEven: boolean;
    isViolating: boolean;
    reason: string;
  };
}

interface GanjilGenapCapture {
  id: string;
  license_plate: string;
  location: string;
  created_at: string;
  type: string;
}


export default function GanjilGenapPage() {
  const [data, setData] = useState<GanjilGenapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState("");
  const [checking, setChecking] = useState(false);
  const [captures, setCaptures] = useState<GanjilGenapCapture[]>([]);
  const [captureCount, setCaptureCount] = useState(0);
  const [captureLoading, setCaptureLoading] = useState(true);


  const fetchStatus = useCallback(async (plateQuery?: string) => {
    if (!plateQuery) setLoading(true);
    else setChecking(true);
    try {
      const url = plateQuery
        ? `/api/ganjil-genap?plate=${encodeURIComponent(plateQuery)}`
        : `/api/ganjil-genap`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Fetch violations hari ini (sebagai proxy ganjil-genap captures)
  const fetchCaptures = useCallback(async () => {
    setCaptureLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: rows, count } = await supabase
        .from("violations")
        .select("id, license_plate, location, created_at, type", { count: "exact" })
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(5);
      setCaptures(rows ?? []);
      setCaptureCount(count ?? 0);
    } catch {
      // silent
    } finally {
      setCaptureLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptures();
    const interval = setInterval(fetchCaptures, 30000);
    return () => clearInterval(interval);
  }, [fetchCaptures]);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (plate.trim()) fetchStatus(plate.trim());
  };

  const policy = data?.policy;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
            <Car className="h-7 w-7 text-accent-amber" />
            Ganjil Genap (Gage) Monitor
          </h1>
          <p className="text-sm text-text-muted">
            Pemantauan otomatis kebijakan pembatasan kendaraan Jakarta
          </p>
        </div>
        <button
          onClick={() => fetchStatus()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-border"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Status Banner */}
      {policy && (
        <div className={cn(
          "rounded-2xl border-2 p-6 flex flex-col sm:flex-row items-center gap-6 transition-all",
          policy.isEnforced
            ? "border-accent-red/50 bg-accent-red/10"
            : policy.isHoliday
            ? "border-accent-green/30 bg-accent-green/10"
            : "border-border bg-bg-secondary"
        )}>
          <div className={cn(
            "flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full text-4xl",
            policy.isEnforced ? "bg-accent-red/20" : "bg-accent-green/20"
          )}>
            {policy.isEnforced ? "🚫" : policy.isHoliday ? "🎉" : "✅"}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className={cn(
              "text-2xl font-bold mb-1",
              policy.isEnforced ? "text-accent-red" : "text-accent-green"
            )}>
              {policy.isEnforced
                ? `GAGE AKTIF — Plat ${policy.restrictedPlate} Dilarang`
                : policy.isHoliday
                ? "HARI LIBUR — Gage Tidak Berlaku"
                : "GAGE TIDAK AKTIF"}
            </div>
            <p className="text-text-secondary">
              {policy.day}, {policy.date} | Tanggal {policy.dateIsOdd ? "Ganjil" : "Genap"}
              {policy.activeSession && ` | Sesi ${policy.activeSession === "pagi" ? "Pagi (06:00–10:00)" : "Sore (16:00–21:00)"}`}
            </p>
            {!policy.isEnforced && policy.nextSession && (
              <p className="text-sm text-accent-amber mt-1">
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                {policy.nextSession.label} dimulai dalam {policy.nextSession.minutesUntil} menit
              </p>
            )}
          </div>
          {/* Sessions info */}
          <div className="flex flex-col gap-2">
            {policy.sessions.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-text-muted" />
                <span className="text-text-muted">{s.label}:</span>
                <span className="text-white font-mono">{s.start}–{s.end}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plate Checker */}
      <div className="rounded-xl border border-border bg-bg-secondary p-6">
        <h2 className="font-heading text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent-blue" />
          Cek Plat Nomor
        </h2>
        <form onSubmit={handleCheck} className="flex gap-3">
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="Contoh: B 1234 CD"
            className="flex-1 rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm font-mono text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={checking || !plate.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
            Cek Plat
          </button>
        </form>

        {/* Result */}
        {data?.plateCheck && (
          <div className={cn(
            "mt-4 rounded-xl border p-4 flex items-start gap-3",
            data.plateCheck.isViolating
              ? "border-accent-red/40 bg-accent-red/10"
              : "border-accent-green/40 bg-accent-green/10"
          )}>
            {data.plateCheck.isViolating ? (
              <XCircle className="h-6 w-6 text-accent-red mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-accent-green mt-0.5 shrink-0" />
            )}
            <div>
              <p className={cn("font-bold text-base", data.plateCheck.isViolating ? "text-accent-red" : "text-accent-green")}>
                {data.plateCheck.isViolating ? "⚠️ MELANGGAR GANJIL GENAP" : "✅ BOLEH MELINTAS"}
              </p>
              <p className="text-sm text-text-secondary mt-1">{data.plateCheck.reason}</p>
              <p className="text-xs text-text-muted mt-1 font-mono">
                Digit terakhir: {data.plateCheck.lastDigit} ({data.plateCheck.plateIsEven ? "Genap" : "Ganjil"})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats + Zones Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Zona", value: data?.stats.totalZones ?? "—", icon: MapPin, color: "text-accent-blue" },
          { label: "Cakupan Jalan", value: data ? `${data.stats.kmCoverage} km` : "—", icon: Calendar, color: "text-accent-amber" },
          { label: "Sesi Aktif", value: policy?.activeSession ?? "Tidak Aktif", icon: Clock, color: policy?.isEnforced ? "text-accent-red" : "text-text-muted" },
          { label: "Plat Dilarang", value: policy?.isEnforced ? (policy.restrictedPlate ?? "-") : "-", icon: Car, color: "text-accent-red" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-bg-secondary p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={cn("h-4 w-4", item.color)} />
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{item.label}</p>
            </div>
            <p className={cn("text-xl font-bold", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Zone List */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-bg-tertiary">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            ZONA PEMBATASAN AKTIF ({data?.zones.length ?? 0} Ruas Jalan)
          </h2>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-bg-tertiary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-bg-tertiary rounded" />
                  <div className="h-3 w-64 bg-bg-tertiary rounded" />
                </div>
              </div>
            ))
          ) : (
            data?.zones.map((zone) => (
              <div key={zone.id} className="px-6 py-4 flex items-center gap-4 hover:bg-bg-tertiary/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-amber/10 border border-accent-amber/20">
                  <MapPin className="h-5 w-5 text-accent-amber" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{zone.name}</p>
                  <p className="text-xs text-text-muted">{zone.description}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs text-text-muted">
                    {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                  </span>
                </div>
                {policy?.isEnforced && (
                  <span className="inline-flex items-center rounded-full bg-accent-red/10 border border-accent-red/20 px-2.5 py-1 text-xs font-semibold text-accent-red">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Aktif
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Penangkapan Hari Ini (Cross-ref Violations) ─────────────────── */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent-amber" />
            Pelanggaran Terdeteksi Hari Ini
          </h3>
          <div className="flex items-center gap-3">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold border bg-accent-red/10 border-accent-red/20 text-accent-red">
              {captureCount} pelanggaran
            </span>
            {captureCount > 0 && (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold border bg-accent-green/10 border-accent-green/20 text-accent-green flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Est. PAD: Rp {((captureCount * GANJIL_GENAP_PAD_PER_VIOLATION * 0.3) / 1_000_000).toFixed(1)} Jt
              </span>
            )}
          </div>
        </div>
        {captureLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-bg-tertiary animate-pulse" />
            ))}
          </div>
        ) : captures.length === 0 ? (
          <div className="py-10 text-center text-text-muted text-sm">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>Belum ada pelanggaran terdeteksi hari ini</p>
            <p className="text-xs mt-1">Jalankan <code className="text-accent-cyan">npm run seed:demo</code> untuk data demo</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {captures.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-bg-tertiary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-red/10 border border-accent-red/20 flex-shrink-0">
                    <Car className="h-4 w-4 text-accent-red" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-white text-sm">{c.license_plate}</p>
                    <p className="text-xs text-text-muted flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{c.location ?? "Lokasi tidak diketahui"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-accent-red rounded-full bg-accent-red/10 px-2 py-1 border border-accent-red/20">
                    {c.type?.replace(/_/g, " ") ?? "PELANGGARAN"}
                  </span>
                  <p className="text-[10px] text-text-muted mt-1 font-mono">
                    {new Date(c.created_at).toLocaleTimeString("id-ID")}
                  </p>
                </div>
              </div>
            ))}
            {captureCount > 5 && (
              <div className="px-5 py-3 text-center text-xs text-text-muted">
                ...dan {captureCount - 5} pelanggaran lainnya hari ini
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4 flex gap-3">
        <Info className="h-5 w-5 text-accent-blue mt-0.5 shrink-0" />
        <p className="text-sm text-text-secondary">
          <strong className="text-white">Tentang Ganjil Genap:</strong> Kebijakan ini membatasi kendaraan berplat ganjil/genap 
          melintas di 5 ruas jalan utama Jakarta pada jam sibuk. Tidak berlaku pada akhir pekan dan hari libur nasional.
          Pelanggaran dikenakan tilang E-TLE dengan denda hingga Rp 500.000.
        </p>
      </div>
    </div>
  );
}
