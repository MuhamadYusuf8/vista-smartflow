"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Save, UserCog, Settings2, Sliders, Server, Layout } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "ai", name: "Sistem AI", icon: Sliders },
  { id: "users", name: "Pengguna", icon: UserCog, adminOnly: true },
  { id: "etle", name: "Integrasi E-TLE", icon: Server },
  { id: "preferences", name: "Preferensi Tampilan", icon: Layout },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "VIEWER";
  
  const [activeTab, setActiveTab] = useState("ai");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [durationThreshold, setDurationThreshold] = useState(300);

  const availableTabs = tabs.filter(t => !t.adminOnly || userRole === "ADMIN");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Pengaturan Sistem
          </h1>
          <p className="text-sm text-text-muted">
            Konfigurasi model AI, pengguna, dan integrasi VISTA
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-500">
          <Save className="h-4 w-4" />
          Simpan Perubahan
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all text-left",
                  activeTab === tab.id
                    ? "bg-accent-blue/10 text-accent-blue font-semibold border border-accent-blue/20"
                    : "text-text-muted hover:bg-bg-tertiary hover:text-white border border-transparent"
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 rounded-xl border border-border bg-bg-secondary p-6">
          
          {activeTab === "ai" && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <h3 className="text-lg font-heading font-bold text-white mb-4">Parameter Deteksi AI</h3>
                
                <div className="space-y-6">
                  {/* Slider 1 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-text-secondary">Ambang Batas Kepercayaan ANPR (Confidence Threshold)</label>
                      <span className="text-sm font-mono text-accent-cyan">{confidenceThreshold}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" max="99" 
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-cyan"
                    />
                    <p className="mt-2 text-xs text-text-muted">Deteksi di bawah persentase ini akan otomatis dibuang oleh filter.</p>
                  </div>

                  {/* Slider 2 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-text-secondary">Waktu Toleransi Parkir Liar (Detik)</label>
                      <span className="text-sm font-mono text-accent-red">{durationThreshold}s</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" max="600" step="30"
                      value={durationThreshold}
                      onChange={(e) => setDurationThreshold(Number(e.target.value))}
                      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-red"
                    />
                    <p className="mt-2 text-xs text-text-muted">Waktu maksimal kendaraan boleh berhenti di zona larangan sebelum dicatat sebagai pelanggaran.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-lg font-heading font-bold text-white mb-4">Model Pengenalan Platform</h3>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-accent-blue/20 bg-accent-blue/5">
                  <Settings2 className="h-8 w-8 text-accent-blue" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">YOLOv8 - Indonesian License Plates Custom</p>
                    <p className="text-sm text-text-muted">Versi 2.4.1 (Terakhir diupdate: 12 Okt 2023)</p>
                  </div>
                  <button className="text-sm px-3 py-1.5 rounded bg-bg-tertiary text-text-secondary border border-border hover:text-white transition-colors">
                    Cek Pembaruan
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Manajemen Pengguna</h3>
              <p className="text-sm text-text-muted mb-4">Hanya Admin yang dapat menambah atau mengubah akses pengguna.</p>
              
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-tertiary text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Peran</th>
                      <th className="px-4 py-3 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-bg-tertiary/30">
                      <td className="px-4 py-3 font-medium text-white">Administrator</td>
                      <td className="px-4 py-3 text-text-muted">admin@dishub.go.id</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-accent-blue/10 px-2 py-1 text-xs font-semibold text-accent-blue border border-accent-blue/20">ADMIN</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-text-muted hover:text-white text-xs">Edit</button>
                      </td>
                    </tr>
                    <tr className="hover:bg-bg-tertiary/30">
                      <td className="px-4 py-3 font-medium text-white">Petugas Lapangan 1</td>
                      <td className="px-4 py-3 text-text-muted">officer@dishub.go.id</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-accent-green/10 px-2 py-1 text-xs font-semibold text-accent-green border border-accent-green/20">OFFICER</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-text-muted hover:text-white text-xs">Edit</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "etle" && (
            <div className="space-y-6 max-w-2xl">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Konfigurasi Endpoint E-TLE</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">API Endpoint URL</label>
                  <input type="text" defaultValue="https://api.etle.korlantas.polri.go.id/v1/sync" className="w-full rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">API Key (Secret)</label>
                  <input type="password" defaultValue="************************" className="w-full rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue" />
                </div>
              </div>

              <button className="mt-4 inline-flex items-center justify-center rounded-lg border border-accent-blue/50 bg-accent-blue/10 px-4 py-2 text-sm font-semibold text-accent-blue transition-all hover:bg-accent-blue hover:text-white">
                Test Connection
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
