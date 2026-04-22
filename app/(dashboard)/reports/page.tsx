"use client";

import { Download, FileText, UploadCloud, Calendar as CalendarIcon, Server, Activity } from "lucide-react";
import { format } from "date-fns";
import { VehicleTypeChart } from "@/components/dashboard/VehicleTypeChart";

const mockVehicleData = [
  { name: "CAR", value: 125, color: "#3B82F6" },
  { name: "MOTORCYCLE", value: 87, color: "#10B981" },
  { name: "BUS", value: 42, color: "#F59E0B" },
  { name: "TRUCK", value: 24, color: "#EF4444" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Laporan & Integrasi E-TLE
          </h1>
          <p className="text-sm text-text-muted">
            Summary statistik, export data, dan status integrasi sistem
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column: Stats & System */}
        <div className="space-y-8 xl:col-span-1">
          {/* Section A: Stats Summary */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="font-heading text-lg font-bold text-white mb-4 border-b border-border pb-3">
              Ringkasan Rekapitulasi
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-3">
                <span className="text-sm text-text-secondary">Waktu</span>
                <span className="text-sm font-medium text-white inline-flex items-center gap-1.5"><CalendarIcon className="h-4 w-4 text-text-muted" /> {format(new Date(), "MMM yyyy")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-3">
                <span className="text-sm text-text-secondary">Total Pelanggaran</span>
                <span className="text-lg font-bold text-white">4,892</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-bg-tertiary p-3">
                <span className="text-sm text-text-secondary">Tingkat Penyelesaian</span>
                <span className="text-lg font-bold text-accent-green">89.4%</span>
              </div>
            </div>

            <div className="mt-6 h-[250px]">
              <VehicleTypeChart data={mockVehicleData} />
            </div>
          </section>

          {/* Section C: System Performance */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="font-heading text-lg font-bold text-white mb-4 border-b border-border pb-3 flex items-center justify-between">
              Status Sistem
              <span className="inline-flex items-center gap-1 rounded bg-accent-green/10 px-2 py-1 text-[10px] font-bold text-accent-green uppercase tracking-wider">
                <div className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
                Normal
              </span>
            </h2>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted flex items-center gap-1.5"><Activity className="h-4 w-4" /> Server E-TLE Uptime</span>
                  <span className="font-mono text-white">99.98%</span>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green w-[99.98%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted flex items-center gap-1.5"><Server className="h-4 w-4" /> AI Node Usage</span>
                  <span className="font-mono text-white">42%</span>
                </div>
                <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-accent-blue w-[42%]" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Export & ETLE */}
        <div className="xl:col-span-2 space-y-8">
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-border pb-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-white">Sinkronisasi E-TLE</h2>
                <p className="text-sm text-text-muted mt-1">Ekspor data pelanggaran terverifikasi ke sistem tilang elektronik nasional</p>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 px-3 py-1.5 text-xs font-semibold text-accent-blue">
                  Connected
                </span>
              </div>
            </div>

            {/* Mock Table for Export */}
            <div className="rounded-lg border border-border overflow-hidden bg-bg-primary mb-6">
              <div className="bg-bg-tertiary px-4 py-2 border-b border-border flex justify-between items-center">
                <span className="text-xs font-semibold text-text-secondary">ANTREAN EKSPOR (5 DATA)</span>
                <span className="text-xs font-medium text-text-muted">Siap dikirim</span>
              </div>
              <div className="p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <tbody className="divide-y divide-border">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="hover:bg-bg-tertiary/30">
                        <td className="px-4 py-3 font-mono text-xs text-text-muted">
                          SYS-ID-{8942 + i}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          B {1000 + i * 23} CD
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-accent-red/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-accent-red">PARKIR LIAR</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-text-muted">{format(new Date(Date.now() - Math.random() * 86400000), "dd MMM, HH:mm")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-lg bg-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                <UploadCloud className="h-5 w-5" />
                Sync ke Pusat Data E-TLE
              </button>
              <div className="flex flex-1 gap-3">
                <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-border">
                  <Download className="h-4 w-4" />
                  Unduh CSV
                </button>
                <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-3 text-sm font-semibold text-accent-red hover:bg-accent-red/10 hover:border-accent-red/30 hover:text-accent-red transition-all">
                  <FileText className="h-4 w-4" />
                  Cetak PDF
                </button>
              </div>
            </div>
            
          </section>
        </div>
      </div>
    </div>
  );
}
