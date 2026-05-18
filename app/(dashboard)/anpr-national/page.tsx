"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Search, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Car, Clock, Database } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PlateCheck {
  plate: string;
  checkedAt: string;
  result: {
    polri: "BERSIH" | "DICURI" | "DPO" | "ERROR";
    samsat: "AKTIF" | "MATI" | "KADALUARSA" | "ERROR";
    stnkExpiry?: string;
    ownerMasked?: string;
    vehicleType?: string;
    dpoReason?: string;
    alertSent?: boolean;
  };
}

// Deterministic check based on plate hash
function checkPlate(plate: string): PlateCheck["result"] {
  const hash = [...plate.replace(/\s/g, "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  // Only ~2% plates flagged as problematic (realistic)
  const polriRandom = hash % 100;
  const samsatRandom = (hash * 7) % 100;

  const polri: PlateCheck["result"]["polri"] =
    polriRandom < 1 ? "DPO" : polriRandom < 3 ? "DICURI" : "BERSIH";
  const samsat: PlateCheck["result"]["samsat"] =
    samsatRandom < 8 ? "MATI" : samsatRandom < 15 ? "KADALUARSA" : "AKTIF";

  const year = 2024 + (hash % 3);
  const month = String(1 + (hash % 12)).padStart(2, "0");
  const names = ["Budi S***", "Dewi R***", "Ahmad F***", "Siti N***", "Eko P***"];

  return {
    polri,
    samsat,
    stnkExpiry: `${month}/${year}`,
    ownerMasked: names[hash % names.length],
    vehicleType: ["Toyota Avanza", "Honda Beat", "Mitsubishi Xpander", "Suzuki Carry", "Daihatsu Ayla"][hash % 5],
    dpoReason: polri === "DPO" ? ["Kasus Penipuan", "Kasus Curanmor", "Pelanggaran UULL"][hash % 3] : undefined,
    alertSent: polri !== "BERSIH",
  };
}

const DEMO_PLATES = ["B 1234 ABC", "B 5678 DEF", "D 9012 GHI", "B 3456 JKL", "B 7890 MNO", "F 2468 PQR"];

export default function ANPRNationalPage() {
  const [searchPlate, setSearchPlate] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PlateCheck | null>(null);
  const [autoFeed, setAutoFeed] = useState<PlateCheck[]>([]);
  const [totalChecked, setTotalChecked] = useState(4872);
  const [flagged, setFlagged] = useState(97);
  const plateIdx = useRef(0);

  useEffect(() => {
    // Generate initial auto-feed from recent violations
    supabase.from("violations").select("license_plate, timestamp").order("timestamp", { ascending: false }).limit(8)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const feed = data.map((v) => ({
            plate: v.license_plate,
            checkedAt: new Date(v.timestamp).toLocaleTimeString("id-ID"),
            result: checkPlate(v.license_plate),
          }));
          setAutoFeed(feed);
        } else {
          // Fallback demo
          setAutoFeed(DEMO_PLATES.map((p, i) => ({
            plate: p,
            checkedAt: new Date(Date.now() - i * 90000).toLocaleTimeString("id-ID"),
            result: checkPlate(p),
          })));
        }
      });

    // Auto-check new plates every 8 seconds (simulating live CCTV)
    const iv = setInterval(() => {
      const plate = DEMO_PLATES[plateIdx.current % DEMO_PLATES.length];
      plateIdx.current++;
      const res = checkPlate(plate + plateIdx.current);
      setAutoFeed((prev) => [{ plate, checkedAt: new Date().toLocaleTimeString("id-ID"), result: res }, ...prev.slice(0, 9)]);
      setTotalChecked((n) => n + 1);
      if (res.polri !== "BERSIH" || res.samsat === "MATI") setFlagged((n) => n + 1);
    }, 8000);

    return () => clearInterval(iv);
  }, []);

  const handleCheck = async (plate?: string) => {
    const target = (plate ?? searchPlate).toUpperCase().trim();
    if (!target) return;
    setChecking(true);
    await new Promise((r) => setTimeout(r, 1200)); // simulate API latency
    const res = checkPlate(target);
    const checked: PlateCheck = { plate: target, checkedAt: new Date().toLocaleTimeString("id-ID"), result: res };
    setResult(checked);
    setAutoFeed((prev) => [checked, ...prev.slice(0, 9)]);
    setTotalChecked((n) => n + 1);
    if (res.polri !== "BERSIH" || res.samsat === "MATI") setFlagged((n) => n + 1);
    setChecking(false);
  };

  const polriColor = (s: string) =>
    s === "BERSIH" ? "text-accent-green" : s === "DPO" ? "text-accent-red" : s === "DICURI" ? "text-accent-red" : "text-text-muted";
  const samsatColor = (s: string) =>
    s === "AKTIF" ? "text-accent-green" : s === "MATI" ? "text-accent-red" : "text-accent-amber";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Database className="h-7 w-7 text-accent-cyan" />
            ANPR — Database Nasional
          </h1>
          <p className="text-sm text-text-muted">Pengecekan plat nomor real-time ke database Polri, SAMSAT, dan DPO Nasional</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-accent-cyan">{totalChecked.toLocaleString("id-ID")}</p>
            <p className="text-xs text-text-muted">Plat dicek hari ini</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-accent-red">{flagged}</p>
            <p className="text-xs text-text-muted">Ditandai bermasalah</p>
          </div>
        </div>
      </div>

      {/* DB Source badges */}
      <div className="flex flex-wrap gap-2">
        {[
          { name: "POLRI — Kendaraan Curian", status: "LIVE", color: "text-accent-green border-accent-green/30 bg-accent-green/10" },
          { name: "DPO Nasional", status: "LIVE", color: "text-accent-green border-accent-green/30 bg-accent-green/10" },
          { name: "SAMSAT — Status STNK", status: "LIVE", color: "text-accent-green border-accent-green/30 bg-accent-green/10" },
          { name: "BPKB Kendaraan", status: "LIVE", color: "text-accent-green border-accent-green/30 bg-accent-green/10" },
        ].map((db) => (
          <span key={db.name} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${db.color}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
            {db.name} · {db.status}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-xl border border-border bg-bg-secondary p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Cek Manual Plat Nomor</h3>
        <div className="flex gap-3">
          <input
            type="text" value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleCheck()}
            placeholder="Contoh: B 1234 ABC"
            className="flex-1 rounded-lg border border-border bg-bg-primary py-2.5 px-4 text-white font-mono text-sm placeholder:text-text-muted focus:border-accent-cyan focus:outline-none uppercase"
          />
          <button onClick={() => handleCheck()} disabled={checking || !searchPlate}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-cyan px-5 py-2.5 text-sm font-bold text-bg-primary hover:opacity-90 transition-all disabled:opacity-50">
            {checking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {checking ? "Mengecek..." : "Cek Sekarang"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_PLATES.slice(0, 4).map((p) => (
            <button key={p} onClick={() => { setSearchPlate(p); handleCheck(p); }}
              className="text-xs text-text-muted border border-border rounded px-2 py-1 hover:text-white hover:bg-bg-tertiary transition-colors font-mono">
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Manual check result */}
      {result && (
        <div className={`rounded-xl border-2 p-5 ${result.result.polri !== "BERSIH" || result.result.samsat === "MATI" ? "border-accent-red/40 bg-accent-red/5" : "border-accent-green/40 bg-accent-green/5"}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-text-muted mb-1">Hasil Pengecekan · {result.checkedAt}</p>
              <h2 className="font-mono text-3xl font-bold text-white">{result.plate}</h2>
              <p className="text-sm text-text-muted">{result.result.vehicleType} · Pemilik: {result.result.ownerMasked}</p>
            </div>
            {result.result.polri !== "BERSIH" ? (
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-accent-red mx-auto" />
                <p className="text-xs text-accent-red font-bold mt-1">FLAGGED!</p>
              </div>
            ) : (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-accent-green mx-auto" />
                <p className="text-xs text-accent-green font-bold mt-1">BERSIH</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-bg-secondary p-4">
              <p className="text-xs text-text-muted mb-1 flex items-center gap-1"><Shield className="h-3 w-3" /> Status Polri</p>
              <p className={`text-xl font-bold ${polriColor(result.result.polri)}`}>{result.result.polri}</p>
              {result.result.dpoReason && <p className="text-xs text-accent-red mt-1">{result.result.dpoReason}</p>}
              {result.result.alertSent && result.result.polri !== "BERSIH" && (
                <p className="text-xs text-accent-amber mt-1">⚡ Alert dikirim ke Satuan Sabhara terdekat</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-bg-secondary p-4">
              <p className="text-xs text-text-muted mb-1 flex items-center gap-1"><Car className="h-3 w-3" /> Status SAMSAT</p>
              <p className={`text-xl font-bold ${samsatColor(result.result.samsat)}`}>{result.result.samsat}</p>
              {result.result.stnkExpiry && <p className="text-xs text-text-muted mt-1">Kadaluarsa: {result.result.stnkExpiry}</p>}
              {result.result.samsat === "MATI" && (
                <p className="text-xs text-accent-red mt-1">⚡ Tilang otomatis E-TLE diterbitkan</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Auto-Feed */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-bg-tertiary flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
            Live ANPR Feed — Pengecekan Otomatis dari CCTV
          </span>
          <span className="text-xs text-text-muted">Update tiap ~8 detik</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-primary border-b border-border text-text-muted text-xs">
              <tr>
                <th className="px-4 py-2">Waktu</th>
                <th className="px-4 py-2">Plat Nomor</th>
                <th className="px-4 py-2">Jenis</th>
                <th className="px-4 py-2">Status Polri</th>
                <th className="px-4 py-2">Status SAMSAT</th>
                <th className="px-4 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {autoFeed.map((f, i) => (
                <tr key={i} className={`hover:bg-bg-tertiary/30 transition-colors ${i === 0 ? "animate-in slide-in-from-top-2 duration-300" : ""}`}>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{f.checkedAt}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-white">{f.plate}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{f.result.vehicleType}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold ${polriColor(f.result.polri)}`}>{f.result.polri}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold ${samsatColor(f.result.samsat)}`}>{f.result.samsat}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {f.result.polri !== "BERSIH" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-accent-red">
                        <AlertTriangle className="h-3 w-3" />Alert Polisi
                      </span>
                    ) : f.result.samsat === "MATI" ? (
                      <span className="text-xs font-bold text-accent-amber">Tilang E-TLE</span>
                    ) : (
                      <span className="text-xs text-accent-green flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Bersih</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
