import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/traffic-metrics
 * Menerima data volume lalu lintas dari AI Engine Python.
 * Dipanggil setiap 60 detik dengan jumlah kendaraan dalam frame saat itu.
 *
 * Body: {
 *   camera_id:     string (UUID atau nama kamera),
 *   vehicle_count: number,
 *   avg_speed_kmh?: number,
 *   congestion?:   number (0.0 – 1.0),
 * }
 *
 * GET /api/traffic-metrics
 * Mengembalikan statistik volume lalu lintas terkini per kamera.
 * Query params: ?camera_id=<uuid>&hours=<number>
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { camera_id, vehicle_count, avg_speed_kmh, congestion } = body;

    if (vehicle_count === undefined) {
      return NextResponse.json({ error: "Field 'vehicle_count' wajib diisi." }, { status: 400 });
    }

    // Resolve camera_id
    let resolvedCameraId: string | null = null;
    if (camera_id) {
      const isUuid = typeof camera_id === "string" && camera_id.length === 36;
      if (isUuid) {
        resolvedCameraId = camera_id;
      } else {
        const { data: cam } = await supabaseAdmin
          .from("cameras")
          .select("id")
          .ilike("name", `%${String(camera_id).replace(/-/g, " ")}%`)
          .single();
        if (!cam) {
          // Fallback ke kamera aktif pertama
          const { data: fallback } = await supabaseAdmin
            .from("cameras")
            .select("id")
            .eq("status", "ACTIVE")
            .limit(1)
            .single();
          resolvedCameraId = fallback?.id ?? null;
        } else {
          resolvedCameraId = cam.id;
        }
      }
    }

    // Hitung congestion otomatis jika tidak dikirim
    // Formula: vehicle_count > 30 = macet parah, < 5 = lancar
    const calculatedCongestion = congestion ??
      Math.min(1.0, Math.max(0.0, (vehicle_count - 3) / 25));

    const { error } = await supabaseAdmin
      .from("traffic_metrics")
      .insert({
        camera_id: resolvedCameraId,
        vehicle_count,
        avg_speed_kmh: avg_speed_kmh ?? null,
        congestion: Math.round(calculatedCongestion * 100) / 100,
      });

    if (error) {
      console.error("[traffic-metrics POST] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[traffic-metrics POST] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cameraId = searchParams.get("camera_id");
    const hours = Math.min(parseInt(searchParams.get("hours") ?? "6"), 72);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Query metrik per kamera dalam rentang waktu
    let query = supabaseAdmin
      .from("traffic_metrics")
      .select("camera_id, vehicle_count, avg_speed_kmh, congestion, recorded_at, cameras(name, location, lat, lng)")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(500);

    if (cameraId) {
      query = query.eq("camera_id", cameraId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const metrics = data ?? [];

    // Agregat per kamera: ambil nilai rata-rata
    const byCamera: Record<string, {
      camera_id: string;
      name: string;
      location: string;
      lat: number;
      lng: number;
      avg_vehicles: number;
      avg_speed: number | null;
      avg_congestion: number;
      latest_count: number;
      data_points: number;
    }> = {};

    for (const m of metrics) {
      const camObj = Array.isArray(m.cameras) ? m.cameras[0] : m.cameras;
      const cam = camObj as { name: string; location: string; lat: number; lng: number } | null;
      const cid = m.camera_id ?? "unknown";
      if (!byCamera[cid]) {
        byCamera[cid] = {
          camera_id: cid,
          name: cam?.name ?? "Unknown",
          location: cam?.location ?? "",
          lat: cam?.lat ?? -6.2,
          lng: cam?.lng ?? 106.8,
          avg_vehicles: 0,
          avg_speed: null,
          avg_congestion: 0,
          latest_count: 0,
          data_points: 0,
        };
      }
      const entry = byCamera[cid];
      entry.data_points++;
      entry.avg_vehicles += m.vehicle_count;
      entry.avg_congestion += m.congestion ?? 0;
      if (m.avg_speed_kmh != null) {
        entry.avg_speed = (entry.avg_speed ?? 0) + m.avg_speed_kmh;
      }
    }

    // Normalize averages + set latest_count dari record terbaru
    const cameraIds = Object.keys(byCamera);
    for (const cid of cameraIds) {
      const entry = byCamera[cid];
      const n = entry.data_points;
      entry.avg_vehicles = Math.round(entry.avg_vehicles / n);
      entry.avg_congestion = Math.round((entry.avg_congestion / n) * 100) / 100;
      if (entry.avg_speed !== null) {
        entry.avg_speed = Math.round(entry.avg_speed / n);
      }
    }

    // latest_count per kamera (record paling baru)
    for (const m of metrics) {
      const cid = m.camera_id ?? "unknown";
      if (byCamera[cid] && byCamera[cid].latest_count === 0) {
        byCamera[cid].latest_count = m.vehicle_count;
      }
    }

    // Total ringkasan kota
    const allMetrics = Object.values(byCamera);
    const cityAvgVehicles = allMetrics.length
      ? Math.round(allMetrics.reduce((s, c) => s + c.avg_vehicles, 0) / allMetrics.length)
      : 0;
    const cityAvgCongestion = allMetrics.length
      ? Math.round((allMetrics.reduce((s, c) => s + c.avg_congestion, 0) / allMetrics.length) * 100) / 100
      : 0;

    return NextResponse.json({
      period_hours: hours,
      since,
      total_data_points: metrics.length,
      cameras: allMetrics,
      city_summary: {
        avg_vehicle_count: cityAvgVehicles,
        avg_congestion: cityAvgCongestion,
        congestion_level: cityAvgCongestion >= 0.8 ? "MACET TOTAL"
          : cityAvgCongestion >= 0.55 ? "MACET"
          : cityAvgCongestion >= 0.3  ? "PADAT"
          : "LANCAR",
      },
      _source: "VISTA_TrafficMetrics_v1",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[traffic-metrics GET] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
