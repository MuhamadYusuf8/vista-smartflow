"use client";

import { useState } from "react";
import { Plus, Search, Settings2, Video, Activity, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

// Mock Data
const mockCameras = Array.from({ length: 12 }).map((_, i) => ({
  id: `cam-${i}`,
  name: `CCTV - Lokasi ${i + 1}`,
  status: Math.random() > 0.8 ? "MAINTENANCE" : (Math.random() > 0.9 ? "INACTIVE" : "ACTIVE"),
  location: ["Jl. Jend. Sudirman", "Jl. MH Thamrin", "Jl. Gatot Subroto", "Bundaran HI"][Math.floor(Math.random() * 4)],
  violationsToday: Math.floor(Math.random() * 50),
  uptime: 99.9 - Math.random() * 2
}));

export default function CamerasPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const activeCount = mockCameras.filter(c => c.status === "ACTIVE").length;
  const inactiveCount = mockCameras.filter(c => c.status === "INACTIVE").length;
  const maintenanceCount = mockCameras.filter(c => c.status === "MAINTENANCE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            CCTV Monitor
          </h1>
          <p className="text-sm text-text-muted">
            Kelola dan pantau status kamera E-TLE yang terhubung
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
          <Plus className="h-5 w-5" />
          Tambah Kamera
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-bg-secondary p-4 flex flex-col justify-center">
          <p className="text-sm text-text-muted mb-1">Total Kamera</p>
          <p className="font-heading font-bold text-2xl text-white">{mockCameras.length}</p>
        </div>
        <div className="rounded-xl border border-accent-green/20 bg-accent-green/5 p-4 flex flex-col justify-center">
          <p className="text-sm text-accent-green mb-1 font-medium">Aktif Merekam</p>
          <p className="font-heading font-bold text-2xl text-accent-green">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 p-4 flex flex-col justify-center">
          <p className="text-sm text-accent-red mb-1 font-medium">Tidak Aktif</p>
          <p className="font-heading font-bold text-2xl text-accent-red">{inactiveCount}</p>
        </div>
        <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4 flex flex-col justify-center">
          <p className="text-sm text-accent-amber mb-1 font-medium">Maintenance</p>
          <p className="font-heading font-bold text-2xl text-accent-amber">{maintenanceCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-border bg-bg-secondary p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Cari nama kamera atau lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-primary py-2 pl-9 pr-4 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-all"
          />
        </div>
        <div className="flex gap-2">
          {['Semua', 'Aktif', 'Maintenance', 'Tidak Aktif'].map(filter => (
            <button key={filter} className="rounded-md border border-border bg-bg-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-white transition-colors">
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mockCameras.map((camera) => (
          <div key={camera.id} className="group rounded-xl border border-border bg-bg-secondary overflow-hidden transition-all hover:border-border/80">
            {/* Header */}
            <div className="border-b border-border p-4 flex items-center justify-between bg-bg-secondary/50">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-text-muted" />
                <h3 className="font-semibold text-white truncate max-w-[150px]">{camera.name}</h3>
              </div>
              <StatusBadge type="cameraStatus" value={camera.status} />
            </div>

            {/* Video Placeholder */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {camera.status === "ACTIVE" ? (
                <>
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/jakarta-traffic/800/600')] bg-cover bg-center opacity-40"></div>
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent-red animate-pulse"></div>
                    <span className="text-[10px] font-mono font-bold text-white uppercase bg-black/50 px-1 rounded">REC</span>
                  </div>
                </>
              ) : camera.status === "MAINTENANCE" ? (
                <div className="flex flex-col items-center text-accent-amber">
                  <Settings2 className="h-8 w-8 mb-2 animate-spin-slow" />
                  <span className="text-sm font-medium">System Maintenance</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-text-muted">
                  <Video className="h-8 w-8 mb-2 opacity-50" />
                  <span className="text-sm font-medium">Signal Lost</span>
                </div>
              )}
            </div>

            {/* Stats Footer */}
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-text-muted flex items-center gap-1"><Activity className="h-3 w-3" /> Uptime 30 Hari</p>
                <p className="text-sm font-medium text-white">{camera.uptime.toFixed(1)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-text-muted flex items-center gap-1"><MapPin className="h-3 w-3" /> Pelanggaran (Hari ini)</p>
                <p className="text-sm font-medium text-accent-red">{camera.violationsToday}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border p-3 flex gap-2">
              <button className="flex-1 rounded py-1.5 text-xs font-medium text-text-secondary border border-border hover:bg-bg-tertiary transition-colors">
                Configure
              </button>
              <button className="flex-1 rounded py-1.5 text-xs font-medium text-accent-blue border border-accent-blue/30 bg-accent-blue/5 hover:bg-accent-blue/10 transition-colors">
                Live View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
