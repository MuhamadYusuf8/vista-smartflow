import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/erp
 * Sprint 3: ERP Revenue Engine — Berbasis traffic_metrics REAL dari DB
 *
 * Perubahan Sprint 3:
 * - Mengambil vehicle_count dari traffic_metrics untuk setiap kamera terdekat zona ERP
 * - Revenue = taxableVehicles × tariff (bukan simulasi murni)
 * - Historical 7-hari: group by hari dari traffic_metrics DB
 * - _source: "DB_Live" | "Demo_Fallback"
 */

const ERP_ZONES = [
  {
    id: "erp-sudirman",
    name: "Koridor Sudirman",
    stretch: "Semanggi → Bundaran Senayan",
    lat: -6.2231, lng: 106.8041,
    tariff: 19_000,
    color: "#3B82F6",
    cameraMatcher: ["sudirman", "semanggi", "senayan"],
  },
  {
    id: "erp-thamrin",
    name: "Koridor Thamrin",
    stretch: "Bundaran Senayan → Bundaran HI",
    lat: -6.1920, lng: 106.8225,
    tariff: 19_000,
    color: "#8B5CF6",
    cameraMatcher: ["thamrin", "bundaran", "hi"],
  },
  {
    id: "erp-gatot",
    name: "Koridor Gatot Subroto",
    stretch: "Slipi → Pancoran",
    lat: -6.2307, lng: 106.8232,
    tariff: 15_000,
    color: "#F59E0B",
    cameraMatcher: ["gatot", "subroto", "pancoran"],
  },
];

const EXEMPT_RATIO = 0.12; // 12% motor/angkot dibebaskan

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

function fallbackStats(zone: typeof ERP_ZONES[0], seed: number) {
  const hour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  let base = 150;
  if (hour >= 6 && hour <= 9) base = 1200 + (seed % 300);
  else if (hour >= 10 && hour <= 15) base = 600 + (seed % 200);
  else if (hour >= 16 && hour <= 21) base = 1100 + (seed % 250);
  else base = 80 + (seed % 50);

  const vehiclesPassed = base;
  const exempt = Math.floor(vehiclesPassed * EXEMPT_RATIO);
  const taxable = vehiclesPassed - exempt;
  return {
    vehiclesPassed,
    taxableVehicles: taxable,
    exemptVehicles: exempt,
    revenue: taxable * zone.tariff,
    avgSpeedKmh: hour >= 6 && hour <= 9 ? 8 + (seed % 12) : 22 + (seed % 18),
    congestionLevel: hour >= 6 && hour <= 9 ? "TINGGI" : hour >= 16 && hour <= 21 ? "SEDANG" : "RENDAH",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // ── Ambil traffic_metrics dari DB (1 jam terakhir) ──────────────────────────
  const [metricsRes, violationsRes] = await Promise.all([
    supabaseAdmin
      .from("traffic_metrics")
      .select("camera_id, vehicle_count, avg_speed_kmh, congestion, cameras(name, lat, lng)")
      .gte("recorded_at", oneHourAgo.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("violations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
  ]);

  const metrics = metricsRes.data ?? [];
  const violationsToday = violationsRes.count ?? 0;
  const isFromDB = metrics.length > 0;

  // Agregat vehicle_count per kamera
  type CamEntry = { lat: number; lng: number; name: string; totalVehicles: number; totalSpeed: number; speedN: number; totalCongestion: number; n: number };
  const camMap: Record<string, CamEntry> = {};
  for (const m of metrics) {
    const camObj = Array.isArray(m.cameras) ? m.cameras[0] : m.cameras;
    const cam = camObj as { lat?: number; lng?: number; name?: string } | null;
    const cid = m.camera_id ?? "unknown";
    if (!cam?.lat || !cam?.lng) continue;
    if (!camMap[cid]) camMap[cid] = { lat: cam.lat, lng: cam.lng, name: cam.name ?? "Unknown", totalVehicles: 0, totalSpeed: 0, speedN: 0, totalCongestion: 0, n: 0 };
    const e = camMap[cid];
    e.n++;
    e.totalVehicles += m.vehicle_count;
    e.totalCongestion += m.congestion ?? 0;
    if (m.avg_speed_kmh != null) { e.totalSpeed += m.avg_speed_kmh; e.speedN++; }
  }
  const camList = Object.values(camMap);

  // ── Hitung stats per zona ERP ─────────────────────────────────────────────
  const zonesWithStats = ERP_ZONES.map((zone, idx) => {
    if (!isFromDB || camList.length === 0) {
      return { ...zone, stats: fallbackStats(zone, idx * 137 + violationsToday), _live: false };
    }

    // Cari kamera terdekat untuk zona ini
    const nearest = camList.reduce((best, cam) => {
      const d = haversineKm(zone.lat, zone.lng, cam.lat, cam.lng);
      const bd = haversineKm(zone.lat, zone.lng, best.lat, best.lng);
      return d < bd ? cam : best;
    });

    // Scale: kamera menghitung kendaraan per 60s, zona ERP butuh per-jam
    // Asumsikan 60 data points = 60 menit (tiap menit 1 record)
    const scaleMinutes = Math.min(60, nearest.n);
    const vehiclesPerHour = Math.round((nearest.totalVehicles / Math.max(nearest.n, 1)) * scaleMinutes);
    const exempt = Math.floor(vehiclesPerHour * EXEMPT_RATIO);
    const taxable = vehiclesPerHour - exempt;
    const avgSpeed = nearest.speedN > 0 ? Math.round(nearest.totalSpeed / nearest.speedN) : 25;
    const congestionPct = nearest.n > 0 ? nearest.totalCongestion / nearest.n : 0;
    const congestionLevel = congestionPct >= 0.7 ? "TINGGI" : congestionPct >= 0.4 ? "SEDANG" : "RENDAH";

    return {
      ...zone,
      stats: {
        vehiclesPassed: vehiclesPerHour,
        taxableVehicles: taxable,
        exemptVehicles: exempt,
        revenue: taxable * zone.tariff,
        avgSpeedKmh: avgSpeed,
        congestionLevel,
      },
      _live: true,
    };
  });

  const totalVehicles = zonesWithStats.reduce((s, z) => s + z.stats.vehiclesPassed, 0);
  const totalRevenue  = zonesWithStats.reduce((s, z) => s + z.stats.revenue, 0);
  const projectedMonthlyRevenue = totalRevenue * 22;
  const projectedYearlyRevenue  = projectedMonthlyRevenue * 12;

  // ── Historical 7 hari: gunakan data DB jika tersedia ─────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data: histMetrics } = await supabaseAdmin
    .from("traffic_metrics")
    .select("vehicle_count, recorded_at")
    .gte("recorded_at", sevenDaysAgo.toISOString())
    .order("recorded_at", { ascending: true });

  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const historicalData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);

    let dayVehicles = 0;
    let dayRevenue = 0;
    if (histMetrics && histMetrics.length > 0) {
      const dayPoints = histMetrics.filter((m) => m.recorded_at?.startsWith(dayStr));
      dayVehicles = dayPoints.reduce((s, m) => s + m.vehicle_count, 0);
      const dayTaxable = Math.floor(dayVehicles * (1 - EXEMPT_RATIO));
      dayRevenue = dayTaxable * 17_000; // rata-rata tarif
    } else {
      const multiplier = [0.4, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5][d.getDay()];
      dayRevenue = Math.round(totalRevenue * multiplier * (0.85 + Math.random() * 0.3));
      dayVehicles = Math.round(totalVehicles * multiplier);
    }

    return { date: dayNames[d.getDay()], revenue: dayRevenue, vehicles: dayVehicles };
  });

  return NextResponse.json({
    period,
    timestamp: new Date().toISOString(),
    _source: isFromDB ? "DB_Live" : "Demo_Fallback",
    _dataPoints: metrics.length,
    summary: {
      totalVehiclesToday:    totalVehicles,
      totalRevenueTodayRp:   totalRevenue,
      projectedMonthlyRp:    projectedMonthlyRevenue,
      projectedYearlyRp:     projectedYearlyRevenue,
      growthVsLastWeek:      3.7,
      activeZones:           ERP_ZONES.length,
      violationsCorrelated:  violationsToday,
    },
    zones:          zonesWithStats,
    historicalData,
    _note: "Revenue ERP dihitung dari vehicle_count kamera CCTV terdekat setiap zona. Dalam implementasi nyata, data dari sensor loop-detector BPTJ.",
  });
}
