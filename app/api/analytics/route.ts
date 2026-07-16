import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/analytics
 * Sprint 3: AI City Insight Engine (v2)
 *
 * Mengagregat seluruh data sistem dalam satu panggilan:
 * - Violations summary (24 jam)
 * - Traffic metrics summary (1 jam terakhir)
 * - Vehicle sightings summary (24 jam)
 * - Estimasi PAD harian
 * - 3 AI-generated city insights berbasis kondisi aktual
 */

const TARIFF_ETLE = 250_000;  // Rp per pelanggaran
const CONVERSION_RATE = 0.30; // 30% yang benar-benar bayar

export async function GET() {
  const now = new Date();
  const jakartaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayStart = new Date(jakartaNow);
  todayStart.setHours(0, 0, 0, 0);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // ── Semua query paralel ──────────────────────────────────────────────────────
  const [
    violationsRes,
    violationsVerifiedRes,
    trafficRes,
    sightingsRes,
    sightingsFlaggedRes,
    topLocationRes,
    topTypeRes,
    hourlyViolationsRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("violations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),

    supabaseAdmin
      .from("violations")
      .select("*", { count: "exact", head: true })
      .in("status", ["VERIFIED", "EXPORTED"])
      .gte("created_at", todayStart.toISOString()),

    supabaseAdmin
      .from("traffic_metrics")
      .select("camera_id, vehicle_count, avg_speed_kmh, congestion, cameras(name, location)")
      .gte("recorded_at", oneHourAgo.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(200),

    supabaseAdmin
      .from("vehicle_sightings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),

    supabaseAdmin
      .from("vehicle_sightings")
      .select("*", { count: "exact", head: true })
      .eq("is_flagged", true)
      .gte("created_at", todayStart.toISOString()),

    supabaseAdmin
      .from("violations")
      .select("location")
      .gte("created_at", todayStart.toISOString())
      .not("location", "is", null),

    supabaseAdmin
      .from("violations")
      .select("type")
      .gte("created_at", todayStart.toISOString()),

    supabaseAdmin
      .from("violations")
      .select("created_at")
      .gte("created_at", twoHoursAgo.toISOString())
      .order("created_at", { ascending: true }),
  ]);

  // ── Hitung violations stats ───────────────────────────────────────────────
  const violationsToday    = violationsRes.count ?? 0;
  const violationsVerified = violationsVerifiedRes.count ?? 0;
  const padToday           = Math.round(violationsVerified * TARIFF_ETLE * CONVERSION_RATE);

  const locCount: Record<string, number> = {};
  (topLocationRes.data ?? []).forEach((v) => {
    if (v.location) locCount[v.location] = (locCount[v.location] ?? 0) + 1;
  });
  const topLocation = Object.entries(locCount).sort(([, a], [, b]) => b - a)[0];

  const typeCount: Record<string, number> = {};
  (topTypeRes.data ?? []).forEach((v) => {
    typeCount[v.type] = (typeCount[v.type] ?? 0) + 1;
  });
  const topType = Object.entries(typeCount).sort(([, a], [, b]) => b - a)[0];

  const TYPE_LABELS: Record<string, string> = {
    ILLEGAL_PARKING: "Parkir Liar",
    BUSWAY_VIOLATION: "Masuk Jalur Busway",
    BICYCLE_LANE_VIOLATION: "Masuk Jalur Sepeda",
    BUS_STOP_VIOLATION: "Berhenti di Halte",
    WRONG_LANE: "Salah Lajur",
  };

  // Tren jam ini vs jam sebelumnya
  const hourlyData = hourlyViolationsRes.data ?? [];
  const midPoint    = oneHourAgo.toISOString();
  const recentHour  = hourlyData.filter((d) => d.created_at >= midPoint).length;
  const prevHour    = hourlyData.filter((d) => d.created_at < midPoint).length;
  const trendPct    = prevHour > 0 ? Math.round(((recentHour - prevHour) / prevHour) * 100) : 0;

  // ── Traffic metrics aggregation ───────────────────────────────────────────
  const metrics = trafficRes.data ?? [];
  const isTrafficLive = metrics.length > 0;
  const camAggr: Record<string, { totalCongestion: number; totalSpeed: number; speedCount: number; n: number; name: string }> = {};
  for (const m of metrics) {
    const camObj = Array.isArray(m.cameras) ? m.cameras[0] : m.cameras;
    const camName = (camObj as { name?: string } | null)?.name ?? "Unknown";
    const cid = m.camera_id ?? "unknown";
    if (!camAggr[cid]) camAggr[cid] = { totalCongestion: 0, totalSpeed: 0, speedCount: 0, n: 0, name: camName };
    camAggr[cid].n++;
    camAggr[cid].totalCongestion += m.congestion ?? 0;
    if (m.avg_speed_kmh != null) {
      camAggr[cid].totalSpeed += m.avg_speed_kmh;
      camAggr[cid].speedCount++;
    }
  }
  const camList        = Object.values(camAggr);
  const avgCongestion  = camList.length ? camList.reduce((s, c) => s + c.totalCongestion / c.n, 0) / camList.length : 0;
  const avgSpeed       = camList.length ? camList.reduce((s, c) => s + (c.speedCount > 0 ? c.totalSpeed / c.speedCount : 40), 0) / camList.length : 40;
  const busiestCam     = [...camList].sort((a, b) => b.totalCongestion / b.n - a.totalCongestion / a.n)[0];
  const congestionLevel = avgCongestion >= 0.8 ? "MACET TOTAL" : avgCongestion >= 0.55 ? "MACET" : avgCongestion >= 0.3 ? "PADAT" : "LANCAR";

  // ── Sightings ────────────────────────────────────────────────────────────────
  const totalSightings   = sightingsRes.count ?? 0;
  const flaggedSightings = sightingsFlaggedRes.count ?? 0;

  // ── AI Insight Generator ─────────────────────────────────────────────────────
  type InsightLevel = "info" | "warning" | "critical";
  const insights: { icon: string; level: InsightLevel; title: string; body: string }[] = [];

  // Insight 1: Traffic
  if (isTrafficLive && avgCongestion >= 0.55) {
    insights.push({
      icon: "🚦", level: "warning",
      title: `Kemacetan ${congestionLevel} Terdeteksi`,
      body: `Kamera ${busiestCam?.name ?? "multiple"} mencatat tingkat kemacetan ${Math.round(avgCongestion * 100)}% dalam 1 jam terakhir. Kecepatan rata-rata ~${Math.round(avgSpeed)} km/h. Pertimbangkan aktivasi sinyal adaptif.`,
    });
  } else if (isTrafficLive) {
    insights.push({
      icon: "✅", level: "info",
      title: "Lalu Lintas Relatif Lancar",
      body: `Skor kemacetan kota ${Math.round(avgCongestion * 100)}/100. Kecepatan rata-rata ~${Math.round(avgSpeed)} km/h. Tidak ada hotspot kritis saat ini.`,
    });
  } else {
    insights.push({
      icon: "📡", level: "info",
      title: "Menunggu Data Sensor Kamera",
      body: "Belum ada data traffic_metrics dalam 1 jam terakhir. Pastikan AI Engine Python berjalan dan mengirimkan metrik tiap 60 detik, atau jalankan seed demo: npm run seed:demo",
    });
  }

  // Insight 2: Violations trend
  if (trendPct >= 30) {
    insights.push({
      icon: "⚠️", level: "critical",
      title: `Lonjakan Pelanggaran +${trendPct}%`,
      body: `${recentHour} pelanggaran dalam 1 jam terakhir — meningkat ${trendPct}% vs jam sebelumnya (${prevHour}). ${topLocation ? `Hotspot: ${topLocation[0]} (${topLocation[1]} kasus).` : ""}`,
    });
  } else if (violationsToday > 0) {
    const typeLabel = topType ? (TYPE_LABELS[topType[0]] ?? topType[0]) : "—";
    insights.push({
      icon: "📊", level: "info",
      title: `${violationsToday} Pelanggaran Tercatat Hari Ini`,
      body: `Jenis terbanyak: ${typeLabel} (${topType?.[1] ?? 0} kasus). ${topLocation ? `Lokasi rawan: ${topLocation[0]}.` : ""} Estimasi PAD: Rp ${(padToday / 1_000_000).toFixed(1)} Jt.`,
    });
  } else {
    insights.push({
      icon: "🎯", level: "info",
      title: "Belum Ada Pelanggaran Hari Ini",
      body: "Sistem aktif memantau seluruh kamera. Jalankan npm run seed:demo untuk mengisi data demonstrasi.",
    });
  }

  // Insight 3: Flagged vehicles / ANPR
  if (flaggedSightings > 0) {
    insights.push({
      icon: "🚨", level: "critical",
      title: `${flaggedSightings} Kendaraan Risiko Tinggi Terdeteksi`,
      body: `${flaggedSightings} kendaraan dengan riwayat ≥3 pelanggaran terdeteksi hari ini dari total ${totalSightings.toLocaleString("id-ID")} sighting. Cek halaman Vehicle Tracking untuk rincian lengkap.`,
    });
  } else if (totalSightings > 0) {
    insights.push({
      icon: "🔍", level: "info",
      title: `${totalSightings.toLocaleString("id-ID")} Kendaraan Terpantau`,
      body: `ANPR memindai semua kendaraan lintas ${Object.keys(camAggr).length} kamera aktif hari ini. Tidak ada kendaraan berisiko tinggi saat ini.`,
    });
  } else {
    insights.push({
      icon: "📷", level: "info",
      title: "ANPR Siap Memantau",
      body: "Sistem pengenalan plat nomor aktif. Data sighting akan muncul saat AI Engine mengirimkan deteksi.",
    });
  }

  return NextResponse.json({
    timestamp:    jakartaNow.toISOString(),
    _source:      isTrafficLive ? "DB_Live" : "DB_Partial",
    violations: {
      today:       violationsToday,
      verified:    violationsVerified,
      topType:     topType ? { type: topType[0], label: TYPE_LABELS[topType[0]] ?? topType[0], count: topType[1] } : null,
      topLocation: topLocation ? { location: topLocation[0], count: topLocation[1] } : null,
      trend:       { recentHour, prevHour, pctChange: trendPct },
    },
    traffic: {
      avgCongestion:   Math.round(avgCongestion * 100) / 100,
      congestionLevel,
      avgSpeedKmh:     Math.round(avgSpeed),
      busiestCamera:   busiestCam?.name ?? null,
      dataPoints:      metrics.length,
      isLive:          isTrafficLive,
    },
    sightings: {
      total:   totalSightings,
      flagged: flaggedSightings,
    },
    pad_today_rp: padToday,
    ai_insights:  insights,
  });
}
