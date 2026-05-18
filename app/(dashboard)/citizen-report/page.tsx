"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Camera, CheckCircle2, XCircle, Clock,
  RefreshCw, Send, MapPin, Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface CitizenReport {
  id: string;
  status: string;
  violation_type: string;
  location: string;
  description: string;
  reporter: string;
  aiConfidence: number;
  evidence_url: string;
  submittedAt: string;
  source: string;
}

interface ReportData {
  reports: CitizenReport[];
  total: number;
  pendingAiReview: number;
  verified: number;
  rejected: number;
}

const STATUS_STYLES: Record<string, string> = {
  AI_REVIEW: "bg-accent-amber/10 border-accent-amber/20 text-accent-amber",
  VERIFIED: "bg-accent-green/10 border-accent-green/20 text-accent-green",
  REJECTED: "bg-border text-text-muted border-border",
  PENDING: "bg-accent-blue/10 border-accent-blue/20 text-accent-blue",
};

const STATUS_LABELS: Record<string, string> = {
  AI_REVIEW: "Dianalisis AI",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
  PENDING: "Menunggu",
};

const TYPE_LABELS: Record<string, string> = {
  ILLEGAL_PARKING: "Parkir Liar",
  BUSWAY_VIOLATION: "Jalur Busway",
  WRONG_LANE: "Jalur Salah",
  BICYCLE_LANE_VIOLATION: "Jalur Sepeda",
};

export default function CitizenReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "submit">("list");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [form, setForm] = useState({
    reporter_name: "",
    location: "",
    violation_type: "ILLEGAL_PARKING",
    description: "",
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/citizen-report?limit=20");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/citizen-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setActiveTab("list");
          fetchReports();
        }, 3000);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
            <Users className="h-7 w-7 text-accent-cyan" />
            Laporan Warga (JAKI Integration)
          </h1>
          <p className="text-sm text-text-muted">
            Citizen Reporter — Laporan warga divalidasi AI sebelum diteruskan ke petugas
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm font-medium text-white hover:bg-border"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Laporan", value: data?.total ?? "—", color: "text-white" },
          { label: "Dianalisis AI", value: data?.pendingAiReview ?? "—", color: "text-accent-amber" },
          { label: "Terverifikasi", value: data?.verified ?? "—", color: "text-accent-green" },
          { label: "Ditolak", value: data?.rejected ?? "—", color: "text-text-muted" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-bg-secondary p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">{item.label}</p>
            <p className={cn("text-2xl font-bold", item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* JAKI Info Banner */}
      <div className="rounded-xl border border-accent-cyan/20 bg-accent-cyan/5 p-4 flex gap-3">
        <div className="text-2xl">📱</div>
        <div>
          <p className="font-semibold text-white text-sm">Terintegrasi dengan JAKI (Jakarta Kini)</p>
          <p className="text-xs text-text-muted mt-0.5">
            Warga dapat melaporkan pelanggaran melalui aplikasi JAKI. Foto pelanggaran akan dianalisis AI untuk 
            memvalidasi bukti sebelum diteruskan ke petugas lapangan Dishub.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: "list" as const, label: "Daftar Laporan" },
          { id: "submit" as const, label: "Simulasi Lapor (JAKI)" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-accent-blue/20 border border-accent-blue/30 text-accent-blue"
                : "border border-border text-text-muted hover:text-white hover:bg-bg-tertiary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report List */}
      {activeTab === "list" && (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-primary border-b border-border text-text-muted">
                <tr>
                  {["Waktu", "Pelapor", "Jenis", "Lokasi", "Status AI", "Tindak Lanjut"].map((h) => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-4 w-full rounded bg-bg-tertiary animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (data?.reports ?? []).map((report) => (
                      <tr key={report.id} className="hover:bg-bg-tertiary/40 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {format(new Date(report.submittedAt), "dd MMM, HH:mm", { locale: idLocale })}
                        </td>
                        <td className="px-5 py-4 text-text-secondary">{report.reporter}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium text-white">
                            {TYPE_LABELS[report.violation_type] ?? report.violation_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-text-muted max-w-[180px] truncate" title={report.location}>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {report.location}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              STATUS_STYLES[report.status] ?? "bg-bg-tertiary text-text-muted border-border")}>
                              {STATUS_LABELS[report.status] ?? report.status}
                            </span>
                            <span className="text-xs text-text-muted">
                              {(report.aiConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {report.status === "VERIFIED" ? (
                            <span className="flex items-center gap-1 text-xs text-accent-green">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Diteruskan ke Petugas
                            </span>
                          ) : report.status === "REJECTED" ? (
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              <XCircle className="h-3.5 w-3.5" /> Tidak valid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-accent-amber">
                              <Clock className="h-3.5 w-3.5" /> Menunggu
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Form */}
      {activeTab === "submit" && (
        <div className="rounded-xl border border-border bg-bg-secondary p-6 max-w-2xl">
          {submitted ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-16 w-16 text-accent-green mx-auto mb-4" />
              <p className="text-xl font-bold text-white mb-2">Laporan Terkirim!</p>
              <p className="text-text-muted">AI sedang menganalisis laporan Anda...</p>
            </div>
          ) : (
            <>
              <h2 className="font-heading font-bold text-white mb-5 flex items-center gap-2">
                <Camera className="h-5 w-5 text-accent-cyan" />
                Simulasi Laporan via JAKI
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Pelapor</label>
                    <input
                      value={form.reporter_name}
                      onChange={(e) => setForm((f) => ({ ...f, reporter_name: e.target.value }))}
                      placeholder="Anonim"
                      className="w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Jenis Pelanggaran</label>
                    <select
                      value={form.violation_type}
                      onChange={(e) => setForm((f) => ({ ...f, violation_type: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm text-white focus:border-accent-blue focus:outline-none"
                    >
                      <option value="ILLEGAL_PARKING">Parkir Liar</option>
                      <option value="BUSWAY_VIOLATION">Jalur Busway</option>
                      <option value="WRONG_LANE">Jalur Salah</option>
                      <option value="BICYCLE_LANE_VIOLATION">Jalur Sepeda</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Lokasi Kejadian</label>
                  <input
                    required
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Contoh: Jl. Sudirman depan gedung X"
                    className="w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Deskripsi</label>
                  <textarea
                    required
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Deskripsikan pelanggaran yang Anda lihat..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none resize-none"
                  />
                </div>
                <div className="rounded-lg border border-dashed border-border bg-bg-tertiary p-4 text-center text-text-muted">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Upload foto (fitur tersedia di integrasi JAKI mobile)</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-cyan px-4 py-3 text-sm font-semibold text-bg-primary hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Kirim Laporan
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
