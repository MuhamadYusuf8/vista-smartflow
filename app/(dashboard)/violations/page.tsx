"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, Download, FileText, ChevronLeft, ChevronRight, Search, X, RefreshCw } from "lucide-react";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, Violation } from "@/lib/supabase";

const PAGE_SIZE = 15;

type FilterType = "ALL" | "ILLEGAL_PARKING" | "BUSWAY_VIOLATION" | "BICYCLE_LANE_VIOLATION" | "BUS_STOP_VIOLATION" | "WRONG_LANE";
type FilterStatus = "ALL" | "PENDING" | "VERIFIED" | "EXPORTED" | "DISMISSED";

const TYPE_FILTERS: { label: string; value: FilterType }[] = [
  { label: "Semua Jenis", value: "ALL" },
  { label: "Parkir Liar", value: "ILLEGAL_PARKING" },
  { label: "Jalur Busway", value: "BUSWAY_VIOLATION" },
  { label: "Jalur Sepeda", value: "BICYCLE_LANE_VIOLATION" },
  { label: "Halte Bus", value: "BUS_STOP_VIOLATION" },
  { label: "Salah Lajur", value: "WRONG_LANE" },
];

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "Semua Status", value: "ALL" },
  { label: "Menunggu", value: "PENDING" },
  { label: "Terverifikasi", value: "VERIFIED" },
  { label: "Terkirim E-TLE", value: "EXPORTED" },
  { label: "Ditolak", value: "DISMISSED" },
];

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState<"csv" | "pdf" | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter]);

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("violations")
        .select("*", { count: "exact" })
        .order("timestamp", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (debouncedSearch.trim()) {
        query = query.or(
          `license_plate.ilike.%${debouncedSearch}%,location.ilike.%${debouncedSearch}%`
        );
      }
      if (typeFilter !== "ALL") {
        query = query.eq("type", typeFilter);
      }
      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setViolations(data ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      console.error("Failed to fetch violations:", err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, statusFilter]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = Math.min((page - 1) * PAGE_SIZE + 1, total);
  const to = Math.min(page * PAGE_SIZE, total);

  const handleExport = async (fmt: "csv" | "pdf") => {
    setExportLoading(fmt);
    try {
      const res = await fetch(`/api/export?format=${fmt}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `violations_export.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExportLoading(null);
    }
  };

  const hasActiveFilters = typeFilter !== "ALL" || statusFilter !== "ALL" || debouncedSearch;

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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              showFilters
                ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/30"
                : "bg-bg-tertiary text-white hover:bg-border"
            )}
          >
            <Filter className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-blue text-[10px] font-bold text-white">
                !
              </span>
            )}
          </button>
          <div className="flex rounded-lg border border-border bg-bg-secondary p-1">
            <button
              onClick={() => handleExport("csv")}
              disabled={exportLoading !== null}
              className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-text-muted hover:text-white transition-colors disabled:opacity-50"
            >
              {exportLoading === "csv" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exportLoading !== null}
              className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium text-accent-red hover:text-red-400 bg-accent-red/10 transition-colors disabled:opacity-50"
            >
              {exportLoading === "pdf" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="rounded-xl border border-border bg-bg-secondary p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Cari Plat Nomor atau Lokasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-primary py-2 pl-9 pr-9 text-sm text-white placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter panels */}
        {showFilters && (
          <div className="flex flex-col gap-4 pt-4 border-t border-border md:flex-row">
            <div className="flex-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Jenis Pelanggaran</p>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      typeFilter === f.value
                        ? "bg-accent-blue border-accent-blue text-white"
                        : "border-border bg-bg-tertiary text-text-secondary hover:bg-border hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      statusFilter === f.value
                        ? "bg-accent-blue border-accent-blue text-white"
                        : "border-border bg-bg-tertiary text-text-secondary hover:bg-border hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setTypeFilter("ALL"); setStatusFilter("ALL"); setSearchTerm(""); }}
                className="self-end flex items-center gap-1.5 text-xs text-accent-red hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Reset Filter
              </button>
            )}
          </div>
        )}
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
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 w-full rounded bg-bg-tertiary animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-text-muted">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Tidak ada data pelanggaran</p>
                    <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
                  </td>
                </tr>
              ) : (
                violations.map((v) => (
                  <tr key={v.id} className="hover:bg-bg-tertiary/50 transition-colors">
                    <td className="px-6 py-4 text-text-muted">
                      {format(new Date(v.timestamp), "dd MMM yyyy, HH:mm", { locale: id })}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      <LicensePlate plate={v.license_plate} type={v.vehicle_type === "CAR" ? "car" : "motorcycle"} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge type="violationType" value={v.type} />
                    </td>
                    <td className="px-6 py-4 text-text-secondary max-w-[200px] truncate" title={v.location}>
                      {v.location}
                    </td>
                    <td className="px-6 py-4">
                      {v.duration ? (
                        <span
                          className={cn(
                            "font-mono font-medium",
                            v.duration > 300 ? "text-accent-red" : "text-white"
                          )}
                        >
                          {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, "0")}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-bg-tertiary">
          <span className="text-sm text-text-muted">
            {total === 0 ? (
              "Tidak ada data"
            ) : (
              <>
                Menampilkan <span className="font-medium text-white">{from}</span> hingga{" "}
                <span className="font-medium text-white">{to}</span> dari{" "}
                <span className="font-medium text-white">{total.toLocaleString("id-ID")}</span> pelanggaran
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-muted disabled:opacity-50 hover:bg-border hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded border text-sm font-medium transition-colors",
                    page === pageNum
                      ? "border-accent-blue bg-accent-blue text-white"
                      : "border-border bg-bg-primary text-text-secondary hover:bg-border hover:text-white"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-bg-primary text-text-secondary disabled:opacity-50 hover:bg-border hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
