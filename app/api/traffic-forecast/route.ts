import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/traffic-forecast
 * Prediksi kemacetan berbasis AI — Sprint 2 Upgrade.
 *
 * Perubahan Sprint 2:
 * - Menggunakan data `traffic_metrics` REAL dari DB sebagai baseline skor kemacetan
 * - Model hybrid: data historis dari DB + prediksi heuristik berbasis jam
 * - Menambahkan `_source: "DB_Live" | "Demo_Fallback"` untuk badge di frontend
 * - Menambahkan `liveSpeed` dan `liveCount` per ruas jalan dari kamera terdekat
 */

const HOTSPOT_ROADS = [
  { id: "sudirman",    name: "Jl. Jend. Sudirman", lat: -6.2231, lng: 106.8041 },
  { id: "thamrin",    name: "Jl. MH Thamrin",      lat: -6.1920, lng: 106.8225 },
  { id: "gatot",      name: "Jl. Gatot Subroto",   lat: -6.2307, lng: 106.8232 },
  { id: "rasuna",     name: "Jl. HR Rasuna Said",  lat: -6.2155, lng: 106.8291 },
  { id: "casablanca", name: "Jl. Casablanca",      lat: -6.2227, lng: 106.8407 },
  { id: "bundaran-hi",name: "Bundaran HI",         lat: -6.1947, lng: 106.8230 },
];

type CongestionLevel = "LANCAR" | "PADAT" | "MACET" | "MACET TOTAL";

function getCongestionLevel(score: number): CongestionLevel {
  if (score < 30) return "LANCAR";
  if (score < 55) return "PADAT";
  if (score < 80) return "MACET";
  return "MACET TOTAL";
}

function getCongestionColor(level: CongestionLevel): string {
  const map: Record<CongestionLevel, string> = {
    "LANCAR":      "#10B981",
    "PADAT":       "#F59E0B",
    "MACET":       "#F97316",
    "MACET TOTAL": "#EF4444",
  };
  return map[level];
}

/** Haversine distance dalam km antara dua titik koordinat */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roadFilter = searchParams.get("road");

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const hour   = now.getHours();
  const minute = now.getMinutes();

  // ── Ambil data traffic_metrics terbaru (1 jam terakhir) per kamera ──────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [metricsResult, violationsResult] = await Promise.all([
    supabaseAdmin
      .from("traffic_metrics")
      .select("camera_id, vehicle_count, avg_speed_kmh, congestion, recorded_at, cameras(name, lat, lng)")
      .gte("recorded_at", oneHourAgo.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("violations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneHourAgo.toISOString()),
  ]);

  const metrics        = metricsResult.data ?? [];
  const recentViolations = violationsResult.count ?? 0;
  const isFromDB       = metrics.length > 0;

  // ── Agregat metrik per kamera ─────────────────────────────────────────────
  type CamMetric = {
    lat: number; lng: number;
    avgCongestion: number; avgSpeed: number | null;
    avgCount: number; n: number;
  };
  const camMetrics: Record<string, CamMetric> = {};

  for (const m of metrics) {
    const cid = m.camera_id ?? "unknown";
    const camObj = Array.isArray(m.cameras) ? m.cameras[0] : m.cameras;
    const cam = camObj as { lat: number; lng: number; name: string } | null;
    if (!cam?.lat || !cam?.lng) continue;

    if (!camMetrics[cid]) {
      camMetrics[cid] = { lat: cam.lat, lng: cam.lng, avgCongestion: 0, avgSpeed: null, avgCount: 0, n: 0 };
    }
    const entry = camMetrics[cid];
    entry.n++;
    entry.avgCongestion += m.congestion ?? 0;
    entry.avgCount      += m.vehicle_count;
    if (m.avg_speed_kmh != null) {
      entry.avgSpeed = (entry.avgSpeed ?? 0) + m.avg_speed_kmh;
    }
  }

  // Normalize
  for (const entry of Object.values(camMetrics)) {
    entry.avgCongestion = entry.avgCongestion / entry.n;
    entry.avgCount      = Math.round(entry.avgCount / entry.n);
    if (entry.avgSpeed !== null) entry.avgSpeed = Math.round(entry.avgSpeed / entry.n);
  }

  const camList = Object.values(camMetrics);

  // Activity factor (violations-based, sprint 1 compat)
  const activityFactor = Math.min(1.5, 1 + recentViolations / 20);

  // ── Model prediksi: heuristik berbasis jam + koreksi DB ──────────────────
  function predictScore(roadLat: number, roadLng: number, roadIdx: number, hoursAhead: number): number {
    const targetHour = (hour + hoursAhead) % 24;
    const offset = roadIdx * 7;

    // Profil kemacetan harian Jakarta
    let base = 20;
    if (targetHour >= 6  && targetHour <= 9)  base = 70 + (offset % 20);
    else if (targetHour >= 10 && targetHour <= 15) base = 45 + (offset % 15);
    else if (targetHour >= 16 && targetHour <= 21) base = 75 + (offset % 18);
    else base = 15 + (offset % 10);

    const noise = ((roadIdx * 13 + hoursAhead * 7) % 15) - 7;
    let predicted = Math.round(base * activityFactor + noise);

    // Jika jam sekarang (hoursAhead === 0) dan ada data DB real, koreksi dengan kamera terdekat
    if (hoursAhead < 0.5 && isFromDB && camList.length > 0) {
      const nearest = camList.reduce((best, cam) => {
        const d = distanceKm(roadLat, roadLng, cam.lat, cam.lng);
        return d < distanceKm(roadLat, roadLng, best.lat, best.lng) ? cam : best;
      });
      const dbScore = Math.round(nearest.avgCongestion * 100);
      // Blend: 40% heuristik + 60% DB riil untuk current state
      predicted = Math.round(predicted * 0.4 + dbScore * 0.6);
    }

    return Math.min(100, Math.max(0, predicted));
  }

  const roads = HOTSPOT_ROADS.filter((r) => !roadFilter || r.id === roadFilter);

  const forecasts = roads.map((r, idx) => {
    const currentScore = predictScore(r.lat, r.lng, idx, 0);
    const currentLevel = getCongestionLevel(currentScore);

    // Cari kamera terdekat untuk data live speed & count
    let liveSpeed: number | null = null;
    let liveCount: number | null = null;
    if (isFromDB && camList.length > 0) {
      const nearest = camList.reduce((best, cam) => {
        const d = distanceKm(r.lat, r.lng, cam.lat, cam.lng);
        return d < distanceKm(r.lat, r.lng, best.lat, best.lng) ? cam : best;
      });
      liveSpeed = nearest.avgSpeed;
      liveCount = nearest.avgCount;
    }

    // Prediksi per 30 menit untuk 4 jam ke depan
    const timeline = Array.from({ length: 9 }, (_, i) => {
      const offsetMin  = i * 30;
      const offsetHour = offsetMin / 60;
      const targetMin  = (minute + offsetMin) % 60;
      const targetHr   = (hour + Math.floor((minute + offsetMin) / 60)) % 24;
      const score      = predictScore(r.lat, r.lng, idx, offsetHour);
      const level      = getCongestionLevel(score);
      return {
        time: `${String(targetHr).padStart(2, "0")}:${String(targetMin).padStart(2, "0")}`,
        minutesAhead: offsetMin,
        score,
        level,
        color: getCongestionColor(level),
      };
    });

    const worst      = timeline.slice(1, 5).reduce((a, b) => (a.score > b.score ? a : b));
    const willWorsen = worst.score > currentScore + 15;
    const warningMessage = willWorsen
      ? `⚠️ Diprediksi ${worst.level} dalam ${worst.minutesAhead} menit (pukul ${worst.time})`
      : currentScore > 75
      ? `🔴 ${r.name} saat ini ${currentLevel}. Hindari jalan ini.`
      : `✅ ${r.name} kondisi normal.`;

    return {
      road: r,
      current: {
        score:                currentScore,
        level:                currentLevel,
        color:                getCongestionColor(currentLevel),
        speedEstimateKmh:     liveSpeed ?? Math.round(60 - currentScore * 0.5),
        travelTimeMultiplier: (1 + currentScore / 100).toFixed(1),
        liveSpeed,
        liveCount,
      },
      forecast: timeline,
      warning:  warningMessage,
      willWorsen,
      peakIn: willWorsen ? worst.minutesAhead : null,
    };
  });

  const avgScore = Math.round(
    forecasts.reduce((s, f) => s + f.current.score, 0) / forecasts.length
  );

  // Ambil avg speed kota dari DB
  const cityLiveSpeed = isFromDB && camList.length > 0
    ? Math.round(camList.reduce((s, c) => s + (c.avgSpeed ?? 0), 0) / camList.filter(c => c.avgSpeed !== null).length)
    : null;

  return NextResponse.json({
    timestamp: now.toISOString(),
    _source:   isFromDB ? "DB_Live" : "Demo_Fallback",
    _dataPoints: metrics.length,
    jakartaOverall: {
      avgCongestionScore:       avgScore,
      level:                    getCongestionLevel(avgScore),
      color:                    getCongestionColor(getCongestionLevel(avgScore)),
      recommendation: avgScore > 70
        ? "Kondisi lalu lintas Jakarta saat ini sangat padat. Rekomendasikan penggunaan TransJakarta."
        : avgScore > 45
        ? "Lalu lintas cukup padat. Pertimbangkan rute alternatif."
        : "Kondisi lalu lintas Jakarta relatif lancar.",
      activityFactor:            activityFactor.toFixed(2),
      recentViolationsLastHour:  recentViolations,
      cityAvgSpeedKmh:           cityLiveSpeed,
    },
    roads: forecasts,
    _model: "VISTA-TrafficPredict-v2 (DB Hybrid + Heuristic)",
  });
}
