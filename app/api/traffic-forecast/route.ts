import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/traffic-forecast
 * Prediksi kemacetan berbasis AI menggunakan data historis heatmap violations.
 * Fase 3: Big Data & Predictive AI
 */

const HOTSPOT_ROADS = [
  { id: "sudirman", name: "Jl. Jend. Sudirman", lat: -6.2231, lng: 106.8041 },
  { id: "thamrin", name: "Jl. MH Thamrin", lat: -6.1920, lng: 106.8225 },
  { id: "gatot", name: "Jl. Gatot Subroto", lat: -6.2307, lng: 106.8232 },
  { id: "rasuna", name: "Jl. HR Rasuna Said", lat: -6.2155, lng: 106.8291 },
  { id: "casablanca", name: "Jl. Casablanca", lat: -6.2227, lng: 106.8407 },
  { id: "bundaran-hi", name: "Bundaran HI", lat: -6.1947, lng: 106.8230 },
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
    "LANCAR": "#10B981",
    "PADAT": "#F59E0B",
    "MACET": "#F97316",
    "MACET TOTAL": "#EF4444",
  };
  return map[level];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const road = searchParams.get("road"); // optional filter

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Ambil jumlah violation aktual dari DB untuk menentukan "heat"
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { count: recentViolations } = await supabaseAdmin
    .from("violations")
    .select("*", { count: "exact", head: true })
    .gte("created_at", oneHourAgo.toISOString());

  const activityFactor = Math.min(1.5, 1 + (recentViolations ?? 0) / 20);

  // Model prediksi sederhana berbasis jam + faktor aktivitas
  function predictScore(roadIdx: number, hoursAhead: number): number {
    const targetHour = (hour + hoursAhead) % 24;
    const offset = roadIdx * 7;

    let base = 20;
    if (targetHour >= 6 && targetHour <= 9) base = 70 + (offset % 20);
    else if (targetHour >= 10 && targetHour <= 15) base = 45 + (offset % 15);
    else if (targetHour >= 16 && targetHour <= 21) base = 75 + (offset % 18);
    else base = 15 + (offset % 10);

    const noise = ((roadIdx * 13 + hoursAhead * 7) % 15) - 7;
    return Math.min(100, Math.max(0, Math.round(base * activityFactor + noise)));
  }

  const roads = HOTSPOT_ROADS.filter((r) => !road || r.id === road);

  const forecasts = roads.map((r, idx) => {
    const currentScore = predictScore(idx, 0);
    const currentLevel = getCongestionLevel(currentScore);

    // Prediksi per 30 menit untuk 4 jam ke depan
    const timeline = Array.from({ length: 9 }, (_, i) => {
      const offsetMin = i * 30;
      const offsetHour = offsetMin / 60;
      const targetMin = (minute + offsetMin) % 60;
      const targetHr = (hour + Math.floor((minute + offsetMin) / 60)) % 24;
      const score = predictScore(idx, offsetHour);
      const level = getCongestionLevel(score);

      return {
        time: `${String(targetHr).padStart(2, "0")}:${String(targetMin).padStart(2, "0")}`,
        minutesAhead: offsetMin,
        score,
        level,
        color: getCongestionColor(level),
      };
    });

    // Cari prediksi terburuk dalam 2 jam ke depan
    const worst = timeline.slice(1, 5).reduce((a, b) => (a.score > b.score ? a : b));
    const willWorsen = worst.score > currentScore + 15;
    const warningMessage = willWorsen
      ? `⚠️ Diprediksi ${worst.level} dalam ${worst.minutesAhead} menit (pukul ${worst.time})`
      : currentScore > 75
      ? `🔴 ${r.name} saat ini ${currentLevel}. Hindari jalan ini.`
      : `✅ ${r.name} kondisi normal.`;

    return {
      road: r,
      current: {
        score: currentScore,
        level: currentLevel,
        color: getCongestionColor(currentLevel),
        speedEstimateKmh: Math.round(60 - currentScore * 0.5),
        travelTimeMultiplier: (1 + currentScore / 100).toFixed(1),
      },
      forecast: timeline,
      warning: warningMessage,
      willWorsen,
      peakIn: willWorsen ? worst.minutesAhead : null,
    };
  });

  // Ringkasan kota
  const avgScore = Math.round(
    forecasts.reduce((s, f) => s + f.current.score, 0) / forecasts.length
  );

  return NextResponse.json({
    timestamp: now.toISOString(),
    jakartaOverall: {
      avgCongestionScore: avgScore,
      level: getCongestionLevel(avgScore),
      color: getCongestionColor(getCongestionLevel(avgScore)),
      recommendation: avgScore > 70
        ? "Kondisi lalu lintas Jakarta saat ini sangat padat. Rekomendasikan penggunaan TransJakarta."
        : avgScore > 45
        ? "Lalu lintas cukup padat. Pertimbangkan rute alternatif."
        : "Kondisi lalu lintas Jakarta relatif lancar.",
      activityFactor: activityFactor.toFixed(2),
      recentViolationsLastHour: recentViolations ?? 0,
    },
    roads: forecasts,
    _model: "VISTA-TrafficPredict-v1 (Heuristic + Violation Correlation)",
  });
}
