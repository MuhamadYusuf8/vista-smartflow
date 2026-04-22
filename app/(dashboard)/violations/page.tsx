"use client";

import { useState } from "react";
import { Filter, Download, FileText, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Mock data for the table
const mockViolations = Array.from({ length: 15 }).map((_, i) => ({
  id: `v-${i}`,
  timestamp: new Date(Date.now() - Math.random() * 86400000 * 3),
  licensePlate: `B ${Math.floor(Math.random() * 9000) + 1000} ${['ABC', 'CDE', 'SDF', 'XYZ'][Math.floor(Math.random() * 4)]}`,
  vehicleType: Math.random() > 0.5 ? "CAR" : "MOTORCYCLE",
  type: ["ILLEGAL_PARKING", "BUSWAY_VIOLATION", "BICYCLE_LANE_VIOLATION", "BUS_STOP_VIOLATION", "WRONG_LANE"][Math.floor(Math.random() * 5)],
  location: ["Jl. Jend. Sudirman", "Jl. MH Thamrin", "Jl. Gatot Subroto", "Bundaran HI"][Math.floor(Math.random() * 4)],
  duration: Math.random() > 0.6 ? Math.floor(Math.random() * 600) + 60 : null,
  confidence: 0.75 + Math.random() * 0.24,
  status: ["PENDING", "VERIFIED", "EXPORTED", "DISMISSED"][Math.floor(Math.random() * 4)]
}));

export default function ViolationsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Data Pelanggaran
          </h1>
          <p className="text-sm text-text-muted">
            Kelola dan verifikasi deteksi pelanggaran lalu lintas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-border">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <div className="flex rounded-lg border border-border bg-bg-secondary p-1">
            <button className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-text-muted hover:text-white transition-colors">
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-accent-red hover:text-red-400 bg-accent-red/10 transition-colors">
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-bg-secondary p-4 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Cari Plat Nomor atau Lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-primary py-2 pl-9 pr-4 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-all"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {['Semua', 'Parkir Liar', 'Busway', 'Menunggu', 'Hari Ini'].map((filter) => (
            <span key={filter} className="inline-flex items-center rounded-full border border-border bg-bg-tertiary px-3 py-1 text-xs font-medium text-text-secondary cursor-pointer hover:bg-border hover:text-white transition-colors">
              {filter}
            </span>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-tertiary text-text-secondary border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">TANGGAL & WAKTU</th>
                <th className="px-6 py-4 font-semibold">PLAT NOMOR</th>
                <th className="px-6 py-4 font-semibold">JENIS PELANGGARAN</th>
                <th className="px-6 py-4 font-semibold">LOKASI</th>
                <th className="px-6 py-4 font-semibold">DURASI</th>
                <th className="px-6 py-4 font-semibold">CONFIDENCE</th>
                <th className="px-6 py-4 font-semibold">STATUS</th>
                <th className="px-6 py-4 font-semibold text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockViolations.map((v) => (
                <tr key={v.id} className="hover:bg-bg-tertiary/50 transition-colors">
                  <td className="px-6 py-4 text-text-muted">
                    {format(v.timestamp, "dd MMM yyyy, HH:mm", { locale: id })}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">
                    <LicensePlate plate={v.licensePlate} type={v.vehicleType as any} size="sm" />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge type="violationType" value={v.type} />
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {v.location}
                  </td>
                  <td className="px-6 py-4">
                    {v.duration ? (
                      <span className={cn(
                        "font-mono font-medium",
                        v.duration > 300 ? "text-accent-red" : "text-white"
                      )}>
                        {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 w-32">
                    <ConfidenceBar confidence={v.confidence} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge type="violationStatus" value={v.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/violations/${v.id}`}
                      className="inline-flex items-center justify-center rounded border border-accent-blue/50 bg-accent-blue/10 px-3 py-1.5 text-xs font-semibold text-accent-blue shadow-[0_0_10px_rgba(59,130,246,0.1)] transition-all hover:bg-accent-blue hover:text-white"
                    >
                      Lihat Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-bg-tertiary">
          <span className="text-sm text-text-muted">
            Menampilkan <span className="font-medium text-white">1</span> hingga <span className="font-medium text-white">15</span> dari <span className="font-medium text-white">247</span> pelanggaran
          </span>
          <div className="flex items-center gap-2">
            <button disabled className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-muted disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-white px-2">1</span>
            <button className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-secondary hover:bg-border transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
