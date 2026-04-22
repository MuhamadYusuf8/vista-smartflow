"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle2, ShieldAlert, XCircle, Timer, Camera, MapPin, CalendarClock } from "lucide-react";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

// Mock data (since no DB fetch in client component out of the box without API for this demo structure)
const mockDetail = {
  id: "v-1",
  timestamp: new Date(),
  licensePlate: "B 1234 ABC",
  vehicleType: "CAR",
  type: "ILLEGAL_PARKING",
  location: "Jl. Jend. Sudirman KM 2",
  cameraName: "CCTV - Jl. Sudirman 1",
  duration: 420, // 7 minutes
  confidence: 0.96,
  status: "PENDING",
  evidenceUrl: "https://picsum.photos/seed/jakarta/1200/800"
};

export default function ViolationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  return (
    <div className="space-y-6">
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
            <p className="text-sm text-text-muted">
              ID Referensi: #{resolvedParams.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge type="violationStatus" value={mockDetail.status} className="px-3 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Evidence image */}
        <div className="lg:col-span-2 flex flex-col rounded-xl border border-border bg-bg-secondary overflow-hidden h-full min-h-[500px] relative group">
          <div className="absolute top-4 left-4 z-10">
            <span className="inline-flex rounded bg-black/60 px-3 py-1 text-xs font-mono font-medium text-white backdrop-blur-md">
              CAMERA: {mockDetail.cameraName}
            </span>
          </div>
          
          <img 
            src={mockDetail.evidenceUrl} 
            alt="Bukti Pelanggaran" 
            className="w-full h-full object-cover"
          />

          {/* AI bounding box overlay */}
          <div className="absolute inset-x-12 bottom-20 top-32 pointer-events-none">
            <div className="absolute inset-0 border-2 border-accent-red/80 bg-accent-red/20 shadow-[0_0_20px_rgba(239,68,68,0.3)] backdrop-blur-[1px]">
              {/* Corner markers */}
              <div className="absolute -left-[2px] -top-[2px] h-4 w-4 border-l-[3px] border-t-[3px] border-accent-red"></div>
              <div className="absolute -right-[2px] -top-[2px] h-4 w-4 border-r-[3px] border-t-[3px] border-accent-red"></div>
              <div className="absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-[3px] border-l-[3px] border-accent-red"></div>
              <div className="absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-[3px] border-r-[3px] border-accent-red"></div>
              
              <div className="absolute -top-10 left-1A0 inline-flex items-center gap-2 bg-accent-red px-3 py-1.5 shadow-lg">
                <span className="text-sm font-bold text-white tracking-widest">{mockDetail.licensePlate}</span>
                <span className="text-xs font-medium text-red-100">{mockDetail.confidence * 100}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Metadata Card */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <div className="mb-6 flex justify-center">
              <LicensePlate 
                plate={mockDetail.licensePlate} 
                type={mockDetail.vehicleType as any} 
                size="lg" 
              />
            </div>

            <div className="mb-6 border-b border-border pb-6">
              <ConfidenceBar confidence={mockDetail.confidence} className="mb-4" />
              <StatusBadge type="violationType" value={mockDetail.type} className="w-full justify-center text-sm py-2" />
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 mt-0.5 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Waktu Deteksi</p>
                  <p className="text-sm font-medium text-white">{format(mockDetail.timestamp, "dd MMMM yyyy, HH:mm:ss", { locale: idLocale })}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Lokasi</p>
                  <p className="text-sm font-medium text-white">{mockDetail.location}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 mt-0.5 text-text-muted" />
                <div>
                  <p className="text-xs text-text-muted mb-0.5">Sumber Bukti</p>
                  <p className="text-sm font-medium text-white">{mockDetail.cameraName}</p>
                </div>
              </div>

              {mockDetail.duration && (
                <div className="flex items-start gap-3">
                  <Timer className="h-5 w-5 mt-0.5 text-accent-red" />
                  <div>
                    <p className="text-xs text-text-muted mb-0.5">Durasi Pelanggaran</p>
                    <p className="text-sm font-medium text-accent-red font-mono">
                      {Math.floor(mockDetail.duration / 60)} menit {(mockDetail.duration % 60)} detik
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <h3 className="font-heading font-semibold text-white mb-4">Tindakan Petugas</h3>
            <div className="flex flex-col gap-3">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:bg-green-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                <CheckCircle2 className="h-5 w-5" />
                Verifikasi Validitas
              </button>
              
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                <ShieldAlert className="h-5 w-5" />
                Kirim ke E-TLE
              </button>

              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm font-semibold text-text-muted transition-all hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red">
                <XCircle className="h-5 w-5" />
                Dismiss (Bukan Pelanggaran)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
