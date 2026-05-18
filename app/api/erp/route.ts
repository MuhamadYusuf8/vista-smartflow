import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/erp
 * Modul ERP (Electronic Road Pricing) — Hitung potensi PAD dari kendaraan
 * yang melintas di zona berbayar Jakarta (Sudirman-Thamrin corridor).
 * 
 * Fase 2: Integrasi Lintas Sektoral — Nilai jual politik untuk Dishub & Gubernur.
 */

const ERP_ZONES = [
  {
    id: "erp-sudirman",
    name: "Koridor Sudirman",
    stretch: "Semanggi → Bundaran Senayan",
    lat: -6.2231, lng: 106.8041,
    tariff: 19000, // Rp per kendaraan (tarif ERP Jakarta)
    operatingHours: { start: "06:00", end: "09:00", label: "Pagi" },
    operatingHours2: { start: "16:30", end: "21:00", label: "Sore" },
    color: "#3B82F6",
  },
  {
    id: "erp-thamrin",
    name: "Koridor Thamrin",
    stretch: "Bundaran Senayan → Bundaran HI",
    lat: -6.1920, lng: 106.8225,
    tariff: 19000,
    operatingHours: { start: "06:00", end: "09:00", label: "Pagi" },
    operatingHours2: { start: "16:30", end: "21:00", label: "Sore" },
    color: "#8B5CF6",
  },
  {
    id: "erp-gatot",
    name: "Koridor Gatot Subroto",
    stretch: "Slipi → Pancoran",
    lat: -6.2307, lng: 106.8232,
    tariff: 15000,
    operatingHours: { start: "06:00", end: "09:00", label: "Pagi" },
    operatingHours2: { start: "16:30", end: "21:00", label: "Sore" },
    color: "#F59E0B",
  },
];

function generateZoneStats(zone: typeof ERP_ZONES[0], seed: number) {
  // Simulasi kendaraan berdasarkan jam
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const hour = now.getHours();

  // Volume tinggi di jam sibuk
  let baseVolume = 150;
  if (hour >= 6 && hour <= 9) baseVolume = 1200 + (seed % 300);
  else if (hour >= 10 && hour <= 15) baseVolume = 600 + (seed % 200);
  else if (hour >= 16 && hour <= 21) baseVolume = 1100 + (seed % 250);
  else baseVolume = 80 + (seed % 50);

  const vehiclesPassed = baseVolume;
  const revenue = vehiclesPassed * zone.tariff;
  const exemptVehicles = Math.floor(vehiclesPassed * 0.12); // 12% motor/angkot dibebaskan
  const taxableVehicles = vehiclesPassed - exemptVehicles;
  const actualRevenue = taxableVehicles * zone.tariff;

  return {
    vehiclesPassed,
    taxableVehicles,
    exemptVehicles,
    revenue: actualRevenue,
    avgSpeedKmh: hour >= 6 && hour <= 9 ? 8 + (seed % 12) : 22 + (seed % 18),
    congestionLevel: hour >= 6 && hour <= 9 ? "TINGGI" : hour >= 16 && hour <= 21 ? "SEDANG" : "RENDAH",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "today"; // today | week | month

  // Ambil data violation aktual dari DB untuk korelasi
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count: violationsToday } = await supabaseAdmin
    .from("violations")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString());

  // Hitung statistik per zona
  const zonesWithStats = ERP_ZONES.map((zone, idx) => {
    const stats = generateZoneStats(zone, idx * 137 + (violationsToday ?? 0));
    return { ...zone, stats };
  });

  const totalVehicles = zonesWithStats.reduce((s, z) => s + z.stats.vehiclesPassed, 0);
  const totalRevenue = zonesWithStats.reduce((s, z) => s + z.stats.revenue, 0);

  // Proyeksi harian (asumsi 2 sesi = pagi + sore)
  const projectedDailyRevenue = totalRevenue * (period === "today" ? 1 : 1);
  const projectedMonthlyRevenue = projectedDailyRevenue * 22; // 22 hari kerja
  const projectedYearlyRevenue = projectedMonthlyRevenue * 12;

  // Trend (simulasi peningkatan vs minggu lalu)
  const growthVsLastWeek = 3.7;

  // Historical chart data (7 hari terakhir)
  const historicalData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const multiplier = [0.4, 1.0, 1.0, 1.0, 1.0, 1.0, 0.5][d.getDay()];
    return {
      date: dayNames[d.getDay()],
      revenue: Math.round(projectedDailyRevenue * multiplier * (0.85 + Math.random() * 0.3)),
      vehicles: Math.round(totalVehicles * multiplier * (0.85 + Math.random() * 0.3)),
    };
  });

  return NextResponse.json({
    period,
    timestamp: new Date().toISOString(),
    summary: {
      totalVehiclesToday: totalVehicles,
      totalRevenueTodayRp: totalRevenue,
      projectedMonthlyRp: projectedMonthlyRevenue,
      projectedYearlyRp: projectedYearlyRevenue,
      growthVsLastWeek,
      activeZones: ERP_ZONES.length,
      violationsCorrelated: violationsToday ?? 0,
    },
    zones: zonesWithStats,
    historicalData,
    _note: "Data ERP adalah simulasi untuk keperluan demonstrasi sistem. Dalam implementasi nyata, data diperoleh dari sensor loop-detector dan kamera RFID ERP.",
  });
}
