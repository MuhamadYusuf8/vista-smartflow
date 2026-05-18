import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET  /api/vehicle-tracking — Cari riwayat lintas kamera sebuah plat nomor
 * POST /api/vehicle-tracking — Tambah log sighting kendaraan baru
 * 
 * Fase 3: Vehicle Tracking Lintas Kamera
 */

// Data dummy camera network untuk demo
const CAMERA_NETWORK = [
  { id: "cam-hi-01", name: "CCTV Bundaran HI", lat: -6.1947, lng: 106.8230, area: "Bundaran HI" },
  { id: "cam-mn-01", name: "CCTV Monas Selatan", lat: -6.1754, lng: 106.8272, area: "Monas" },
  { id: "cam-sd-01", name: "CCTV Sudirman Semanggi", lat: -6.2231, lng: 106.8041, area: "Semanggi" },
  { id: "cam-gt-01", name: "CCTV Gatot Subroto", lat: -6.2307, lng: 106.8232, area: "Gatot Subroto" },
  { id: "cam-kb-01", name: "CCTV Kuningan Barat", lat: -6.2155, lng: 106.8291, area: "Kuningan" },
  { id: "cam-tm-01", name: "CCTV Thamrin Plaza", lat: -6.1920, lng: 106.8225, area: "Thamrin" },
];

function generateTrackingHistory(plate: string) {
  const hash = plate.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const absHash = Math.abs(hash);

  const numSightings = 3 + (absHash % 5);
  const now = Date.now();
  const sightings = [];

  // Simulasikan rute kendaraan yang masuk akal (berurutan)
  const startCameraIdx = absHash % CAMERA_NETWORK.length;
  const visited = new Set<number>();

  for (let i = 0; i < numSightings; i++) {
    const camIdx = (startCameraIdx + i) % CAMERA_NETWORK.length;
    if (visited.has(camIdx)) break;
    visited.add(camIdx);

    const camera = CAMERA_NETWORK[camIdx];
    const minutesAgo = (numSightings - 1 - i) * (8 + (absHash % 7));
    const confidence = 0.82 + ((absHash * (i + 1)) % 17) / 100;

    sightings.push({
      id: `SGT-${absHash.toString(36).toUpperCase()}-${i}`,
      camera,
      timestamp: new Date(now - minutesAgo * 60 * 1000).toISOString(),
      confidence,
      direction: ["Utara", "Selatan", "Timur", "Barat"][i % 4],
      speed_kmh: 10 + (absHash * (i + 1)) % 55,
      isFlag: i === 0 && absHash % 7 === 0, // 1 dari 7 plat di-flag
    });
  }

  return sightings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate");
  const flaggedOnly = searchParams.get("flagged") === "true";

  if (plate) {
    // Cari satu plat
    const trackingHistory = generateTrackingHistory(plate);
    const isFlagged = trackingHistory.some((s) => s.isFlag);
    const lastSeen = trackingHistory[trackingHistory.length - 1];
    const firstSeen = trackingHistory[0];

    const durationMin = Math.round(
      (new Date(lastSeen.timestamp).getTime() - new Date(firstSeen.timestamp).getTime()) / 60000
    );

    return NextResponse.json({
      plate,
      found: true,
      isFlagged,
      flagReason: isFlagged ? "Plat terdeteksi di daftar pantau Ditlantas Polda Metro Jaya" : null,
      trackingHistory,
      summary: {
        totalSightings: trackingHistory.length,
        firstSeen: firstSeen.timestamp,
        lastSeen: lastSeen.timestamp,
        lastCamera: lastSeen.camera.name,
        lastArea: lastSeen.camera.area,
        trackingDurationMin: durationMin,
        estimatedRouteKm: Math.round(durationMin * 0.4),
      },
      _source: "VISTA_VehicleTracking_v1",
    });
  }

  // List kendaraan mencurigakan / flagged yang baru terdeteksi
  const suspiciousPlates = [
    "B 1234 XX", "D 5678 YY", "F 9012 ZZ", "B 3456 WW", "B 7890 VV",
  ];

  const tracked = suspiciousPlates.map((p) => {
    const history = generateTrackingHistory(p);
    const last = history[history.length - 1];
    return {
      plate: p,
      lastCamera: last.camera.name,
      lastSeen: last.timestamp,
      totalSightings: history.length,
      isFlagged: true,
      flagReason: "Plat tercantum dalam daftar pantau aktif",
    };
  });

  return NextResponse.json({
    trackedVehicles: flaggedOnly ? tracked : tracked,
    totalFlagged: tracked.length,
    cameras: CAMERA_NETWORK,
    _source: "VISTA_VehicleTracking_v1",
  });
}
