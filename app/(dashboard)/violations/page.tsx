"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Filter, Download, FileText, ChevronLeft, ChevronRight,
  Search, X, RefreshCw, ShieldAlert, CheckCircle2,
  Clock, Ban, TrendingUp,
} from "lucide-react";
import { LicensePlate } from "@/components/shared/LicensePlate";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase, Violation } from "@/lib/supabase";

const PAGE_SIZE = 15;

type FilterType =
  | "ALL"
  | "ILLEGAL_PARKING"
  | "BUSWAY_VIOLATION"
  | "BICYCLE_LANE_VIOLATION"
  | "BUS_STOP_VIOLATION"
  | "WRONG_LANE";

type FilterStatus = "ALL" | "PENDING" | "VERIFIED" | "EXPORTED" | "DISMISSED";

const TYPE_FILTERS: { label: string; value: FilterType; color: string }[] = [
  { label: "Semua Jenis", value: "ALL", color: "text-text-secondary" },
  { label: "Parkir Liar", value: "ILLEGAL_PARKING", color: "text-accent-red" },
  { label: "Jalur Busway", value: "BUSWAY_VIOLATION", color: "text-accent-amber" },
  { label: "Jalur Sepeda", value: "BICYCLE_LANE_VIOLATION", color: "text-accent-green" },
  { label: "Halte Bus", value: "BUS_STOP_VIOLATION", color: "text-accent-blue" },
  { label: "Salah Lajur", value: "WRONG_LANE", color: "text-accent-cyan" },
];

const STATUS_FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "Semua Status", value: "ALL" },
  { label: "Menunggu", value: "PENDING" },
  { label: "Terverifikasi", value: "VERIFIED" },
  { label: "Terkirim E-TLE", value: "EXPORTED" },
  { label: "Ditolak", value: "DISMISSED" },
];

const COL_HEADERS = [
  { label: "TANGGAL & WAKTU", width: "w-44" },
  { label: "PLAT NOMOR", width: "w-36" },
  { label: "JENIS PELANGGARAN", width: "w-44" },
  { label: "LOKASI", width: "w-56" },
  { label: "DURASI", width: "w-24" },
  { label: "CONFIDENCE", width: "w-36" },
  { label: "STATUS", width: "w-36" },
  { label: "AKSI", width: "w-28" },
];

// ─── Mini stat card ──────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function StatCard({ icon: Icon, label, value, color, bgColor, borderColor }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-sm transition-all hover:scale-[1.02]",
        bgColor,
        borderColor
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bgColor, "border", borderColor)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-widest text-text-muted">{label}</p>
        <p className={cn("text-lg font-bold font-heading leading-none mt-0.5", color)}>
          {typeof value === "number" ? value.toLocaleString("id-ID") : value}
        </p>
      </div>
    </div>
  );
}

// ─── Shimmer skeleton row ────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="border-b border-border/50">
      {[44, 32, 40, 52, 20, 36, 28, 24].map((w, j) => (
        <td key={j} className="px-5 py-4">
          <div
            className="h-3.5 rounded-md animate-shimmer"
            style={{ width: `${w * 2}px`, maxWidth: "100%" }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ────────────────────────────────────────────────────────────
export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, verified: 0, exported: 0, dismissed: 0 });
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
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter, statusFilter]);

  // Fetch stat counts once
  useEffect(() => {
    async function fetchStats() {
      const statuses: FilterStatus[] = ["PENDING", "VERIFIED", "EXPORTED", "DISMISSED"];
      const results = await Promise.all(
        statuses.map((s) =>
          supabase
            .from("violations")
            .select("id", { count: "exact", head: true })
            .eq("status", s)
        )
      );
      setStats({
        pending: results[0].count ?? 0,
        verified: results[1].count ?? 0,
        exported: results[2].count ?? 0,
        dismissed: results[3].count ?? 0,
      });
    }
    fetchStats();
  }, []);

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
      if (typeFilter !== "ALL") query = query.eq("type", typeFilter);
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);

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

  useEffect(() => { fetchViolations(); }, [fetchViolations]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = Math.min((page - 1) * PAGE_SIZE + 1, total);
  const to = Math.min(page * PAGE_SIZE, total);
  const hasActiveFilters = typeFilter !== "ALL" || statusFilter !== "ALL" || debouncedSearch;

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

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-red/10 border border-accent-red/20">
              <ShieldAlert className="h-4 w-4 text-accent-red" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
              Data Pelanggaran
            </h1>
          </div>
          <p className="text-sm text-text-muted pl-12">
            Kelola dan verifikasi deteksi pelanggaran lalu lintas secara real-time
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200",
              showFilters || hasActiveFilters
                ? "border-accent-blue/50 bg-accent-blue/10 text-accent-blue shadow-[0_0_16px_rgba(59,130,246,0.2)]"
                : "border-border bg-bg-secondary text-text-secondary hover:border-border/80 hover:text-white"
            )}
          >
            <Filter className="h-4 w-4" />
            Filter
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-blue text-[9px] font-bold text-white">
                ✓
              </span>
            )}
          </button>

          <button
            onClick={() => handleExport("csv")}
            disabled={exportLoading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-accent-green/40 hover:text-accent-green disabled:opacity-50"
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
            className="inline-flex items-center gap-2 rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-2.5 text-sm font-medium text-accent-red transition-all hover:border-accent-red/60 hover:bg-accent-red/20 disabled:opacity-50"
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

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Menunggu"
          value={stats.pending}
          color="text-text-secondary"
          bgColor="bg-bg-secondary"
          borderColor="border-border"
        />
        <StatCard
          icon={CheckCircle2}
          label="Terverifikasi"
          value={stats.verified}
          color="text-accent-green"
          bgColor="bg-accent-green/5"
          borderColor="border-accent-green/20"
        />
        <StatCard
          icon={TrendingUp}
          label="Terkirim E-TLE"
          value={stats.exported}
          color="text-accent-blue"
          bgColor="bg-accent-blue/5"
          borderColor="border-accent-blue/20"
        />
        <StatCard
          icon={Ban}
          label="Ditolak"
          value={stats.dismissed}
          color="text-text-muted"
          bgColor="bg-bg-secondary"
          borderColor="border-border"
        />
      </div>

      {/* ── Search + Filter Panel ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
        {/* Search row */}
        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Cari plat nomor atau lokasi…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-primary py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-text-muted focus:border-accent-blue/60 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setTypeFilter("ALL"); setStatusFilter("ALL"); setSearchTerm(""); }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2.5 text-xs font-semibold text-accent-red hover:bg-accent-red/20 transition-all"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filter
            </button>
          )}
        </div>

        {/* Filter pills */}
        {showFilters && (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4 md:flex-row">
            <div className="flex-1">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Jenis Pelanggaran
              </p>
              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setTypeFilter(f.value)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                      typeFilter === f.value
                        ? "bg-accent-blue border-accent-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                        : "border-border bg-bg-tertiary text-text-secondary hover:border-border/70 hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-border md:h-auto md:w-px" />
            <div className="flex-1">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                      statusFilter === f.value
                        ? "bg-accent-blue border-accent-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                        : "border-border bg-bg-tertiary text-text-secondary hover:border-border/70 hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Data Table ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden flex flex-col">

        {/* Table wrapper — horizontal scroll only */}
        <div
          className="overflow-x-auto"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#3B82F6 #0F1628" }}
        >
          <table className="w-full text-sm border-collapse" style={{ minWidth: "900px" }}>

            {/* Sticky header */}
            <thead>
              <tr className="border-b border-border bg-bg-tertiary">
                {COL_HEADERS.map(({ label, width }) => (
                  <th
                    key={label}
                    className={cn(
                      "px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted whitespace-nowrap select-none",
                      width
                    )}
                  >
                    {label}
                  </th>
                ))}
              </tr>
              {/* Blue accent line */}
              <tr>
                <td
                  colSpan={COL_HEADERS.length}
                  className="p-0"
                  style={{ height: "1px", background: "linear-gradient(90deg, #3B82F6 0%, #06B6D4 60%, transparent 100%)", opacity: 0.5 }}
                />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan={COL_HEADERS.length} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-tertiary border border-border">
                        <Search className="h-6 w-6 text-text-muted opacity-50" />
                      </div>
                      <p className="font-semibold text-text-secondary">Tidak ada data pelanggaran</p>
                      <p className="text-xs text-text-muted">Coba ubah filter atau kata kunci pencarian</p>
                    </div>
                  </td>
                </tr>
              ) : (
                violations.map((v, idx) => (
                  <tr
                    key={v.id}
                    className="table-row-hover border-b border-border/40 last:border-0"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {/* Tanggal & Waktu */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-white">
                          {format(new Date(v.timestamp), "dd MMM yyyy", { locale: id })}
                        </span>
                        <span className="text-[11px] font-mono text-text-muted">
                          {format(new Date(v.timestamp), "HH:mm:ss")}
                        </span>
                      </div>
                    </td>

                    {/* Plat Nomor */}
                    <td className="px-5 py-3.5">
                      <LicensePlate
                        plate={v.license_plate}
                        type={v.vehicle_type === "CAR" ? "car" : "motorcycle"}
                        size="sm"
                      />
                    </td>

                    {/* Jenis */}
                    <td className="px-5 py-3.5">
                      <StatusBadge type="violationType" value={v.type} />
                    </td>

                    {/* Lokasi */}
                    <td
                      className="px-5 py-3.5 text-text-secondary text-xs max-w-[200px] truncate"
                      title={v.location}
                    >
                      {v.location}
                    </td>

                    {/* Durasi */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {v.duration ? (
                        <span
                          className={cn(
                            "font-mono text-xs font-semibold tabular-nums",
                            v.duration > 300 ? "text-accent-red" : "text-white"
                          )}
                        >
                          {Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, "0")}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="px-5 py-3.5 w-36">
                      <ConfidenceBar confidence={v.confidence} />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge type="violationStatus" value={v.status} />
                    </td>

                    {/* Aksi */}
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/violations/${v.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-accent-blue/30 bg-accent-blue/10 px-3 py-1.5 text-[11px] font-bold text-accent-blue transition-all hover:border-accent-blue/70 hover:bg-accent-blue/20 hover:shadow-[0_0_12px_rgba(59,130,246,0.25)] whitespace-nowrap"
                      >
                        Lihat Detail →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 border-t border-border bg-bg-tertiary px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Info */}
          <p className="text-xs text-text-muted">
            {total === 0 ? (
              "Tidak ada data"
            ) : (
              <>
                Menampilkan{" "}
                <span className="font-semibold text-white">{from.toLocaleString("id-ID")}</span>
                {" "}–{" "}
                <span className="font-semibold text-white">{to.toLocaleString("id-ID")}</span>
                {" "}dari{" "}
                <span className="font-semibold text-accent-blue">{total.toLocaleString("id-ID")}</span>{" "}
                pelanggaran
              </>
            )}
          </p>

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-muted transition-all hover:border-accent-blue/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-text-muted select-none">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border text-xs font-semibold transition-all",
                    page === p
                      ? "border-accent-blue bg-accent-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                      : "border-border bg-bg-primary text-text-secondary hover:border-accent-blue/40 hover:text-white"
                  )}
                >
                  {p}
                </button>
              )
            )}

            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-muted transition-all hover:border-accent-blue/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
