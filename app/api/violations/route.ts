import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendTelegramWithRetry, formatViolationTelegramMessage } from "@/lib/telegram";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/violations
 * Menerima data pelanggaran dari AI engine Python.
 * Fase 1: Ditingkatkan dengan Telegram retry mechanism dan Audit Trail.
 */
export async function POST(req: Request) {
  const ipAddress =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    const body = await req.json();

    // Validasi input dasar
    if (!body.type || !body.license_plate || !body.confidence) {
      return NextResponse.json(
        { error: "Data tidak lengkap. Field: type, license_plate, confidence wajib diisi." },
        { status: 400 }
      );
    }

    // Cari kamera dari database
    // Handle kasus lama: Python mengirim "cctv-bhi-01" sebagai camera_id
    const isOldFormatId = body.camera_id && !body.camera_id.includes("-"); // simple uuid check vs string
    const identifier = body.camera_id ?? body.camera_name ?? "CCTV-BHI-01";
    
    // Jika identifier terlihat seperti UUID (panjang 36), cari berdasarkan ID, jika tidak cari berdasarkan name
    const isUuid = identifier.length === 36 && identifier.split("-").length === 5;
    
    const cameraQuery = isUuid
      ? supabase.from("cameras").select("*").eq("id", identifier).single()
      : supabase.from("cameras").select("*").ilike("name", identifier.replace(/-/g, " ")).single();

    const { data: camera } = await cameraQuery;

    let finalCamera = camera;

    // Fallback ekstrim jika masih tidak ketemu (hardcode CCTV BHI 01)
    if (!finalCamera && !isUuid) {
       const fallback = await supabase.from("cameras").select("*").ilike("name", "%BHI%").single();
       if (fallback.data) {
           finalCamera = fallback.data;
       }
    }

    if (!finalCamera) {
      console.warn("[API/violations] Kamera tidak ditemukan:", identifier);
      return NextResponse.json({ error: "Kamera tidak ditemukan di database" }, { status: 404 });
    }

    // Buat ETLE reference unik
    const etleRef = `ETLE-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    // Simpan pelanggaran ke database
    const { data: violation, error: insertError } = await supabase
      .from("violations")
      .insert([
        {
          camera_id: finalCamera.id,
          type: body.type,
          license_plate: body.license_plate,
          vehicle_type: body.vehicle_type ?? "OTHER",
          confidence: body.confidence,
          location: body.location ?? finalCamera.location,
          lat: body.lat ?? finalCamera.lat,
          lng: body.lng ?? finalCamera.lng,
          duration: body.duration ?? null,
          evidence_url: body.evidence_url ?? null,
          status: "PENDING", // AI detects → PENDING. Officer verifies → VERIFIED.
          etle_ref: etleRef,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Catat ke Audit Trail (non-blocking)
    logAudit({
      event: "VIOLATION_VERIFIED",
      targetId: violation.id,
      details: `AI detection: ${body.type} - ${body.license_plate} (confidence: ${Math.round(body.confidence * 100)}%)`,
      ipAddress,
    });

    // Kirim notifikasi Telegram dengan RETRY mechanism
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const message = formatViolationTelegramMessage({
        cameraName: finalCamera.name,
        cameraLocation: finalCamera.location,
        licensePlate: body.license_plate,
        violationType: body.type,
        confidence: body.confidence,
        etleRef,
      });

      // Fire-and-forget dengan retry — tidak memblokir response ke Python
      sendTelegramWithRetry({ message, botToken, chatId, maxRetries: 3 }).then(
        (result) => {
          if (!result.success) {
            console.error(`[API/violations] Telegram notification failed after ${result.attempts} attempts:`, result.error);
          }
        }
      );
    }

    return NextResponse.json({ success: true, violation }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[API/violations POST] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/violations
 * Mengambil daftar pelanggaran dengan filter (untuk internal dashboard use).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20");

    let query = supabase
      .from("violations")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ violations: data ?? [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}