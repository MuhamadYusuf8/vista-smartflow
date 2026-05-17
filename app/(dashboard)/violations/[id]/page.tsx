"use client";

import { use, useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  Timer,
  Camera,
  MapPin,
  CalendarClock,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { SamsatCard } from "@/components/shared/SamsatCard";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase, Violation, Camera as CameraType } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ViolationWithCamera = Violation & { cameras?: CameraType };

export default function ViolationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "VIEWER";
  const [violation, setViolation] = useState<ViolationWithCamera | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const fetchViolation = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("violations")
        .select("*, cameras(*)")
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setViolation(data as ViolationWithCamera);
      }
      setLoading(false);
    };
    fetchViolation();
  }, [id]);

  const updateStatus = async (newStatus: "VERIFIED" | "DISMISSED" | "EXPORTED") => {
    if (!violation) return;
    setActionLoading(newStatus);
    try {
      // Memanggil API route yang memiliki audit trail logging
      const res = await fetch(`/api/violations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengubah status");
      }

      const data = await res.json();
      setViolation(data as ViolationWithCamera);

      const labels: Record<string, string> = {
        VERIFIED: "Pelanggaran berhasil diverifikasi",
        DISMISSED: "Pelanggaran berhasil ditolak",
        EXPORTED: "Data berhasil dikirim ke E-TLE",
      };
      showToast("success", labels[newStatus]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengubah status. Silakan coba lagi.";
      showToast("error", msg);
    } finally {
      setActionLoading(null);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 rounded-lg bg-bg-tertiary" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-[500px] rounded-xl bg-bg-secondary" />
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-bg-secondary" />
            <div className="h-48 rounded-xl bg-bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (notFound || !violation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-accent-red opacity-50" />
        <p className="text-white font-semibold text-lg">Data Pelanggaran Tidak Ditemukan</p>
        <p className="text-text-muted text-sm">ID: {id}</p>
        <Link
          href="/violations"
          className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm text-white hover:bg-border transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const camera = violation.cameras;
  const isPending_ = violation.status === "PENDING";
  const isVerified = violation.status === "VERIFIED";
  const isDismissed = violation.status === "DISMISSED";
  const isExported = violation.status === "EXPORTED";

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-4 text-sm font-medium shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-top-4",
            toast.type === "success"
              ? "border-accent-green/30 bg-accent-green/10 text-accent-green"
              : "border-accent-red/30 bg-accent-red/10 text-accent-red"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/violations"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-muted transition-colors hover:bg-bg-tertiary hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
              Detail Pelanggaran
            </h1>
            <p className="text-sm text-text-muted font-mono">
              #{id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge type="violationStatus" value={violation.status} className="px-3 py-1.5 text-sm" />
          {violation.etle_ref && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-blue/30 bg-accent-blue/10 px-3 py-1.5 text-xs font-mono text-accent-blue">
              <ExternalLink className="h-3.5 w-3.5" />
              {violation.etle_ref}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Evidence image */}
        <div className="lg:col-span-2 flex flex-col rounded-xl border border-border bg-bg-secondary overflow-hidden min-h-[480px] relative">
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <span className="inline-flex rounded bg-black/60 px-3 py-1 text-xs font-mono font-medium text-white backdrop-blur-md">
              CAMERA: {camera?.name ?? "Unknown"}
            </span>
            <span className="inline-flex rounded bg-black/60 px-3 py-1 text-xs font-mono font-medium text-white/70 backdrop-blur-md">
              {format(new Date(violation.timestamp), "dd MMM yyyy · HH:mm:ss", { locale: idLocale })}
            </span>
          </div>

          {violation.evidence_url ? (
            <img
              src={violation.evidence_url}
              alt="Bukti Pelanggaran"
              className="w-full h-full object-cover flex-1"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-bg-tertiary text-text-muted">
              <Camera className="h-16 w-16 opacity-20" />
              <p className="text-sm">Tidak ada gambar bukti tersedia</p>
            </div>
          )}

          {/* AI bounding box overlay */}
          {violation.evidence_url && (
            <div className="absolute inset-x-12 bottom-20 top-32 pointer-events-none">
              <div className="absolute inset-0 border-2 border-accent-red/80 bg-accent-red/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                {/* Corner markers */}
                <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-[3px] border-t-[3px] border-accent-red" />
                <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-[3px] border-t-[3px] border-accent-red" />
                <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-[3px] border-l-[3px] border-accent-red" />
                <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-[3px] border-r-[3px] border-accent-red" />

                <div className="absolute -top-9 left-0 inline-flex items-center gap-2 bg-accent-red px-3 py-1.5 shadow-lg">
                  <span className="text-sm font-bold text-white tracking-widest">
                    {violation.license_plate}
                  </span>
                  <span className="text-xs font-medium text-red-100">
                    {(violation.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Metadata + Actions */}
        <div className="flex flex-col gap-6">
          {/* Metadata Card */}
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <div className="mb-6 flex justify-center">
              <LicensePlate
                plate={violation.license_plate}
                type={violation.vehicle_type === "CAR" ? "car" : "motorcycle"}
                size="lg"
              />
            </div>

            <div className="mb-6 border-b border-border pb-6">
              <ConfidenceBar confidence={violation.confidence} className="mb-4" />
              <StatusBadge
                type="violationType"
                value={violation.type}
                className="w-full justify-center text-sm py-2"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 mt-0.5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Waktu Deteksi</p>
                  <p className="text-sm font-medium text-white">
                    {format(new Date(violation.timestamp), "dd MMMM yyyy, HH:mm:ss", { locale: idLocale })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Lokasi</p>
                  <p className="text-sm font-medium text-white">{violation.location}</p>
                  {(violation.lat && violation.lng) && (
                    <p className="text-xs text-text-muted font-mono mt-0.5">
                      {violation.lat.toFixed(6)}, {violation.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 mt-0.5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Sumber Bukti</p>
                  <p className="text-sm font-medium text-white">{camera?.name ?? "Kamera tidak diketahui"}</p>
                </div>
              </div>

              {violation.duration && (
                <div className="flex items-start gap-3">
                  <Timer className="h-5 w-5 mt-0.5 text-accent-red shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted mb-0.5">Durasi Pelanggaran</p>
                    <p className="text-sm font-medium text-accent-red font-mono">
                      {Math.floor(violation.duration / 60)} menit {violation.duration % 60} detik
                    </p>
                  </div>
                </div>
              )}

              {violation.processed_at && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-accent-green shrink-0" />
                  <div>
                    <p className="text-xs text-text-muted mb-0.5">Diproses Pada</p>
                    <p className="text-sm font-medium text-white">
                      {format(new Date(violation.processed_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Samsat Card */}
          <SamsatCard
            licensePlate={violation.license_plate}
            userRole={userRole}
          />

          {/* Action Buttons */}
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <h3 className="font-heading font-semibold text-white mb-4">Tindakan Petugas</h3>

            {isExported ? (
              <div className="rounded-lg border border-accent-blue/30 bg-accent-blue/10 p-4 text-center">
                <ExternalLink className="h-6 w-6 text-accent-blue mx-auto mb-2" />
                <p className="text-sm font-semibold text-accent-blue">Terkirim ke E-TLE</p>
                <p className="text-xs text-text-muted mt-1 font-mono">{violation.etle_ref}</p>
              </div>
            ) : isDismissed ? (
              <div className="rounded-lg border border-border bg-bg-tertiary p-4 text-center">
                <XCircle className="h-6 w-6 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-secondary">Pelanggaran Ditolak</p>
                <p className="text-xs text-text-muted mt-1">Tidak ada tindakan lebih lanjut</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {isPending_ && (
                  <button
                    onClick={() => updateStatus("VERIFIED")}
                    disabled={actionLoading !== null}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:bg-green-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] disabled:opacity-60"
                  >
                    {actionLoading === "VERIFIED" ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Verifikasi Validitas
                  </button>
                )}

                <button
                  onClick={() => updateStatus("EXPORTED")}
                  disabled={actionLoading !== null || isPending_}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === "EXPORTED" ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-5 w-5" />
                  )}
                  {isPending_ ? "Verifikasi dulu sebelum kirim E-TLE" : "Kirim ke E-TLE"}
                </button>

                {!isDismissed && (
                  <button
                    onClick={() => updateStatus("DISMISSED")}
                    disabled={actionLoading !== null}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-muted transition-all hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red disabled:opacity-60"
                  >
                    {actionLoading === "DISMISSED" ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                    Dismiss (Bukan Pelanggaran)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
