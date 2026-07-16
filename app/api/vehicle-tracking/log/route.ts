import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/vehicle-tracking/log
 *
 * Menerima data sighting kendaraan dari AI Engine Python.
 * Dipanggil setiap kali AI berhasil membaca plat nomor (dengan cooldown 10 detik
 * per plat per kamera di sisi AI Engine — sehingga tidak membanjiri DB).
 *
 * Body: {
 *   license_plate: string,
 *   camera_id?:    string (UUID kamera) atau camera_name (string),
 *   vehicle_type?: "CAR" | "MOTORCYCLE" | "BUS" | "TRUCK",
 *   confidence?:   number (0.0 – 1.0),
 *   speed_kmh?:    number,
 *   direction?:    "Utara" | "Selatan" | "Timur" | "Barat",
 *   snapshot_url?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_plate, camera_id, camera_name, vehicle_type, confidence, speed_kmh, direction, snapshot_url } = body;

    if (!license_plate) {
      return NextResponse.json({ error: "Field 'license_plate' wajib diisi." }, { status: 400 });
    }

    // Resolve camera_id — bisa berupa UUID langsung atau nama kamera
    let resolvedCameraId: string | null = null;

    if (camera_id) {
      const isUuid = typeof camera_id === "string" && camera_id.length === 36 && camera_id.split("-").length === 5;
      if (isUuid) {
        resolvedCameraId = camera_id;
      } else {
        // camera_id berupa string seperti "cctv-bhi-01" → cari berdasarkan name
        const { data: cam } = await supabaseAdmin
          .from("cameras")
          .select("id")
          .ilike("name", `%${camera_id.replace(/-/g, " ")}%`)
          .single();
        resolvedCameraId = cam?.id ?? null;

        // Fallback: cari kamera pertama yang ada
        if (!resolvedCameraId) {
          const { data: fallback } = await supabaseAdmin
            .from("cameras")
            .select("id")
            .eq("status", "ACTIVE")
            .limit(1)
            .single();
          resolvedCameraId = fallback?.id ?? null;
        }
      }
    } else if (camera_name) {
      const { data: cam } = await supabaseAdmin
        .from("cameras")
        .select("id")
        .ilike("name", `%${camera_name}%`)
        .single();
      resolvedCameraId = cam?.id ?? null;
    }

    // Periksa apakah plat ini terdaftar dalam daftar pantau violations (DPO)
    const { count: violationCount } = await supabaseAdmin
      .from("violations")
      .select("id", { count: "exact", head: true })
      .eq("license_plate", license_plate)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 hari terakhir

    const isFlagged = (violationCount ?? 0) >= 3;
    const flagReason = isFlagged
      ? `Terdeteksi ${violationCount} pelanggaran dalam 30 hari terakhir`
      : null;

    // Simpan ke database
    const { data: sighting, error } = await supabaseAdmin
      .from("vehicle_sightings")
      .insert({
        license_plate: license_plate.toUpperCase().trim(),
        camera_id: resolvedCameraId,
        vehicle_type: vehicle_type ?? "CAR",
        confidence: confidence ?? 0.85,
        speed_kmh: speed_kmh ?? null,
        direction: direction ?? null,
        snapshot_url: snapshot_url ?? null,
        is_flagged: isFlagged,
        flag_reason: flagReason,
      })
      .select()
      .single();

    if (error) {
      console.error("[vehicle-tracking/log] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log jika kendaraan terpantau
    if (isFlagged) {
      await logAudit({
        event: "VIOLATION_VERIFIED",
        targetId: sighting.id,
        details: `Kendaraan pantau terdeteksi: ${license_plate} (${violationCount} pelanggaran/30 hari)`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      sighting: {
        id: sighting.id,
        license_plate: sighting.license_plate,
        is_flagged: sighting.is_flagged,
        flag_reason: sighting.flag_reason,
        created_at: sighting.created_at,
      },
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[vehicle-tracking/log] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
