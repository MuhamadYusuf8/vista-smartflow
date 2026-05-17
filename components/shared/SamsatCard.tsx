"use client";

import { useState } from "react";
import { Car, User, FileCheck, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SamsatData {
  plate: string;
  found: boolean;
  owner: {
    name: string;
    nik: string;
    address: string;
  };
  vehicle: {
    brand: string;
    color: string;
    year: number;
    type: string;
  };
  registration: {
    stnk_expiry: string;
    pajak_expiry: string;
    pajak_status: "LUNAS" | "MENUNGGAK";
    total_violations_history: number;
  };
}

interface SamsatCardProps {
  licensePlate: string;
  userRole?: string;
}

/**
 * Komponen kartu data kendaraan dari Samsat Mock API.
 * Fase 2: Integrasi Data Kendaraan (Human-in-the-Loop).
 * - Menampilkan data masking untuk VIEWER (Fase 4)
 * - Admin/Officer melihat data lengkap
 */
export function SamsatCard({ licensePlate, userRole = "VIEWER" }: SamsatCardProps) {
  const [data, setData] = useState<SamsatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/samsat?plate=${encodeURIComponent(licensePlate)}`);
      if (!res.ok) throw new Error("Gagal mengambil data Samsat");
      const json = await res.json();
      setData(json);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Masking nama untuk VIEWER (Fase 4: Data Privacy)
  const maskName = (name: string) => {
    if (userRole !== "VIEWER") return name;
    const parts = name.split(" ");
    return parts.map((p, i) => (i === 0 ? p : p[0] + "*".repeat(p.length - 1))).join(" ");
  };

  const maskAddress = (address: string) => {
    if (userRole !== "VIEWER") return address;
    return address.replace(/No\. \d+/, "No. ***");
  };

  return (
    <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
      <button
        onClick={data ? () => setExpanded(!expanded) : fetchData}
        disabled={loading}
        className="w-full flex items-center justify-between p-5 hover:bg-bg-tertiary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <Car className="h-5 w-5 text-accent-blue" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Data Kendaraan (Samsat)</p>
            <p className="text-xs text-text-muted">
              {data ? "Klik untuk lihat/sembunyikan" : "Klik untuk cek data pemilik"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-4 w-4 text-accent-blue animate-spin" />}
          {!loading && (data ? (
            expanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />
          ) : (
            <span className="text-xs text-accent-blue font-medium">Cek →</span>
          ))}
        </div>
      </button>

      {error && (
        <div className="px-5 pb-4">
          <p className="text-xs text-accent-red flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        </div>
      )}

      {data && expanded && (
        <div className="border-t border-border p-5 space-y-4">
          {/* Data Pemilik */}
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted mb-0.5">Pemilik Kendaraan</p>
              <p className="text-sm font-semibold text-white">{maskName(data.owner.name)}</p>
              {userRole !== "VIEWER" && (
                <p className="text-xs text-text-muted font-mono mt-0.5">NIK: {data.owner.nik}</p>
              )}
              <p className="text-xs text-text-muted mt-0.5">{maskAddress(data.owner.address)}</p>
            </div>
          </div>

          {/* Data Kendaraan */}
          <div className="flex items-start gap-3">
            <Car className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted mb-0.5">Kendaraan</p>
              <p className="text-sm font-semibold text-white">
                {data.vehicle.year} {data.vehicle.brand}
              </p>
              <p className="text-xs text-text-muted">Warna: {data.vehicle.color}</p>
            </div>
          </div>

          {/* Status Pajak & STNK */}
          <div className="flex items-start gap-3">
            <FileCheck className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-text-muted mb-1.5">Status Administrasi</p>
              <div className="flex gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    data.registration.pajak_status === "LUNAS"
                      ? "border-accent-green/20 bg-accent-green/10 text-accent-green"
                      : "border-accent-red/20 bg-accent-red/10 text-accent-red"
                  )}
                >
                  Pajak: {data.registration.pajak_status}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-bg-tertiary px-2.5 py-1 text-[11px] font-mono text-text-muted">
                  STNK: {data.registration.stnk_expiry}
                </span>
              </div>
              {data.registration.total_violations_history > 0 && (
                <p className="mt-2 text-xs text-accent-amber">
                  ⚠️ Riwayat: {data.registration.total_violations_history} pelanggaran sebelumnya
                </p>
              )}
            </div>
          </div>

          {userRole === "VIEWER" && (
            <p className="text-[10px] text-text-muted border-t border-border pt-3">
              🔒 Beberapa data disembunyikan sesuai kebijakan privasi data (UU PDP).
            </p>
          )}
          <p className="text-[10px] text-text-muted">
            Sumber: Samsat Mock API v1 (simulasi data)
          </p>
        </div>
      )}
    </div>
  );
}
