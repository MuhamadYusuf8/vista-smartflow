import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/vehicle-tracking
 *
 * Melacak riwayat pergerakan kendaraan berdasarkan plat nomor,
 * menggunakan data riil dari tabel `vehicle_sightings` di database.
 *
 * Query params:
 *   ?plate=<string>        — cari satu kendaraan
 *   ?flagged=true          — list kendaraan yang terdeteksi ≥3 pelanggaran
 *   ?hours=<number>        — rentang waktu (default: 24 jam)
 */

// Fallback: Data demo jika belum ada sighting riil di DB (untuk cold start demo)
const CAMERA_NETWORK = [
  { id: "cam-hi-01",  name: "CCTV Bundaran HI",          lat: -6.1947,  lng: 106.8230, area: "Bundaran HI" },
  { id: "cam-mn-01",  name: "CCTV Monas Selatan",         lat: -6.1754,  lng: 106.8272, area: "Monas" },
  { id: "cam-sd-01",  name: "CCTV Sudirman Semanggi",     lat: -6.2231,  lng: 106.8041, area: "Semanggi" },
  { id: "cam-gt-01",  name: "CCTV Gatot Subroto",         lat: -6.2307,  lng: 106.8232, area: "Gatot Subroto" },
  { id: "cam-kb-01",  name: "CCTV Kuningan Barat",        lat: -6.2155,  lng: 106.8291, area: "Kuningan" },
  { id: "cam-tm-01",  name: "CCTV Thamrin Plaza",         lat: -6.1920,  lng: 106.8225, area: "Thamrin" },
];

function generateFallbackHistory(plate: string) {
  const hash = Math.abs(plate.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
  const numSightings = 3 + (hash % 4);
  const now = Date.now();
  const sightings = [];
  for (let i = 0; i < numSightings; i++) {
    const camIdx = (hash + i) % CAMERA_NETWORK.length;
    const cam = CAMERA_NETWORK[camIdx];
    const minutesAgo = (numSightings - 1 - i) * (8 + (hash % 7));
    sightings.push({
      id: `DEMO-${hash.toString(36).toUpperCase()}-${i}`,
      camera: { id: cam.id, name: cam.name, lat: cam.lat, lng: cam.lng, area: cam.area },
      timestamp: new Date(now - minutesAgo * 60 * 1000).toISOString(),
      confidence: 0.82 + (hash * (i + 1)) % 17 / 100,
      direction: ["Utara", "Selatan", "Timur", "Barat"][i % 4],
      speed_kmh: 10 + (hash * (i + 1)) % 55,
      isFlag: false,
      _demo: true,
    });
  }
  return sightings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate");
  const flaggedOnly = searchParams.get("flagged") === "true";
  const hours = Math.min(parseInt(searchParams.get("hours") ?? "24"), 168); // max 1 minggu
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // ── Mode 1: Cari satu kendaraan berdasarkan plat
  if (plate) {
    const cleanPlate = plate.toUpperCase().trim();

    // Query dari DB
    const { data: sightings, error } = await supabaseAdmin
      .from("vehicle_sightings")
      .select("*, cameras(id, name, lat, lng, location)")
      .eq("license_plate", cleanPlate)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[vehicle-tracking GET] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Gunakan fallback demo jika tidak ada data riil
    const isFromDB = (sightings?.length ?? 0) > 0;
    const trackingHistory = isFromDB
      ? sightings!.map((s) => {
          const camObj = Array.isArray(s.cameras) ? s.cameras[0] : s.cameras;
          const cam = camObj as { id: string; name: string; lat: number; lng: number; location: string } | null;
          return {
            id: s.id,
            camera: {
              id: cam?.id ?? "unknown",
              name: cam?.name ?? "Unknown Camera",
              lat: cam?.lat ?? -6.2,
              lng: cam?.lng ?? 106.8,
              area: cam?.location ?? "Jakarta",
            },
            timestamp: s.created_at,
            confidence: s.confidence,
            direction: s.direction ?? "N/A",
            speed_kmh: s.speed_kmh ?? 0,
            isFlag: s.is_flagged,
            flagReason: s.flag_reason,
            _demo: false,
          };
        })
      : generateFallbackHistory(cleanPlate);

    // Cek apakah kendaraan ini pernah melanggar
    const { count: violationCount } = await supabaseAdmin
      .from("violations")
      .select("id", { count: "exact", head: true })
      .eq("license_plate", cleanPlate);

    const isFlagged = (violationCount ?? 0) >= 3 || trackingHistory.some((s) => s.isFlag);
    const firstSeen = trackingHistory[0];
    const lastSeen = trackingHistory[trackingHistory.length - 1];

    const durationMin = firstSeen && lastSeen
      ? Math.round((new Date(lastSeen.timestamp).getTime() - new Date(firstSeen.timestamp).getTime()) / 60000)
      : 0;

    return NextResponse.json({
      plate: cleanPlate,
      found: trackingHistory.length > 0,
      isFlagged,
      flagReason: isFlagged ? `Terdeteksi ${violationCount ?? 0} pelanggaran — dipantau sistem VISTA` : null,
      totalViolations: violationCount ?? 0,
      trackingHistory,
      summary: {
        totalSightings: trackingHistory.length,
        firstSeen: firstSeen?.timestamp ?? null,
        lastSeen: lastSeen?.timestamp ?? null,
        lastCamera: lastSeen?.camera.name ?? null,
        lastArea: lastSeen?.camera.area ?? null,
        trackingDurationMin: durationMin,
        estimatedRouteKm: Math.round(durationMin * 0.4),
        isFromDB,
      },
      _source: isFromDB ? "VISTA_VehicleTracking_DB_Live" : "VISTA_VehicleTracking_Demo_Fallback",
    });
  }

  // ── Mode 2: List kendaraan yang terpantau (flagged)
  // Cari plat dengan ≥3 violations dalam 30 hari terakhir
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: flaggedSightings, error: flaggedError } = await supabaseAdmin
    .from("vehicle_sightings")
    .select("license_plate, camera_id, created_at, cameras(name, location), is_flagged, flag_reason")
    .eq("is_flagged", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  if (flaggedError) {
    console.error("[vehicle-tracking flagged] DB error:", flaggedError);
  }

  // Juga ambil plat dari violations
  const { data: violators } = await supabaseAdmin
    .from("violations")
    .select("license_plate, location, timestamp")
    .gte("timestamp", thirtyDaysAgo)
    .order("timestamp", { ascending: false })
    .limit(200);

  // Hitung frekuensi per plat dari violations
  const plateViolationCount: Record<string, { count: number; lastLocation: string; lastSeen: string }> = {};
  for (const v of violators ?? []) {
    if (!plateViolationCount[v.license_plate]) {
      plateViolationCount[v.license_plate] = { count: 0, lastLocation: v.location, lastSeen: v.timestamp };
    }
    plateViolationCount[v.license_plate].count++;
  }

  // Gabungkan: plat dengan ≥3 violations ATAU yang ada di vehicle_sightings dengan is_flagged=true
  const flaggedPlates = new Set<string>();
  const trackedMap: Record<string, {
    plate: string; lastCamera: string; lastArea: string; lastSeen: string;
    totalSightings: number; isFlagged: boolean; flagReason: string; violationCount: number;
  }> = {};

  // Dari violations count
  for (const [plate, info] of Object.entries(plateViolationCount)) {
    if (info.count >= 3) {
      flaggedPlates.add(plate);
      trackedMap[plate] = {
        plate,
        lastCamera: "N/A",
        lastArea: info.lastLocation,
        lastSeen: info.lastSeen,
        totalSightings: 0,
        isFlagged: true,
        flagReason: `${info.count} pelanggaran dalam 30 hari`,
        violationCount: info.count,
      };
    }
  }

  // Dari vehicle_sightings flagged
  for (const s of flaggedSightings ?? []) {
    flaggedPlates.add(s.license_plate);
    const camObj = Array.isArray(s.cameras) ? s.cameras[0] : s.cameras;
    const cam = camObj as { name: string; location: string } | null;
    if (!trackedMap[s.license_plate]) {
      trackedMap[s.license_plate] = {
        plate: s.license_plate,
        lastCamera: cam?.name ?? "N/A",
        lastArea: cam?.location ?? "Jakarta",
        lastSeen: s.created_at,
        totalSightings: 1,
        isFlagged: true,
        flagReason: s.flag_reason ?? "Dalam daftar pantau",
        violationCount: plateViolationCount[s.license_plate]?.count ?? 0,
      };
    } else {
      trackedMap[s.license_plate].totalSightings++;
      trackedMap[s.license_plate].lastCamera = cam?.name ?? trackedMap[s.license_plate].lastCamera;
      trackedMap[s.license_plate].lastArea = cam?.location ?? trackedMap[s.license_plate].lastArea;
    }
  }

  // Fallback jika DB kosong — tampilkan demo data
  const finalList = Object.values(trackedMap);
  const isFromDB = finalList.length > 0;

  if (!isFromDB) {
    // Berikan 5 dummy plates untuk cold start demo
    const demoPlates = ["B 1234 XX", "D 5678 YY", "F 9012 ZZ", "B 3456 WW", "B 7890 VV"];
    const demoList = demoPlates.map((p) => {
      const history = generateFallbackHistory(p);
      const last = history[history.length - 1];
      return {
        plate: p,
        lastCamera: last.camera.name,
        lastArea: last.camera.area,
        lastSeen: last.timestamp,
        totalSightings: history.length,
        isFlagged: true,
        flagReason: "Demo — plat dalam daftar pantau",
        violationCount: 3,
      };
    });

    return NextResponse.json({
      trackedVehicles: demoList,
      totalFlagged: demoList.length,
      cameras: CAMERA_NETWORK,
      _source: "VISTA_VehicleTracking_Demo_Fallback",
    });
  }

  return NextResponse.json({
    trackedVehicles: finalList.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()),
    totalFlagged: finalList.length,
    cameras: CAMERA_NETWORK,
    _source: "VISTA_VehicleTracking_DB_Live",
  });
}
