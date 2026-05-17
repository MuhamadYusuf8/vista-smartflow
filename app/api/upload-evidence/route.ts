import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/upload-evidence
 * Menerima gambar bukti pelanggaran dalam format base64 dari Python AI engine.
 * Upload ke Supabase Storage dan kembalikan URL publik.
 *
 * Body: { image_base64: "...", violation_id?: "...", filename?: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image_base64, filename } = body;

    if (!image_base64) {
      return NextResponse.json(
        { error: "Field 'image_base64' wajib diisi." },
        { status: 400 }
      );
    }

    // Decode base64 ke buffer
    // Format yang diterima: "data:image/jpeg;base64,/9j/4AAQ..." atau murni base64
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Buat nama file unik berdasarkan timestamp
    const timestamp = Date.now();
    const safeFilename = filename
      ? filename.replace(/[^a-z0-9.\-_]/gi, "_")
      : `evidence_${timestamp}.jpg`;

    const filePath = `violations/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${safeFilename}`;

    // Upload ke Supabase Storage bucket "evidence"
    const { error: uploadError } = await supabaseAdmin.storage
      .from("evidence")
      .upload(filePath, buffer, {
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[upload-evidence] Supabase Storage error:", uploadError);
      return NextResponse.json(
        { error: `Upload gagal: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Dapatkan URL publik dari Supabase Storage
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("evidence")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    return NextResponse.json({ success: true, url: publicUrl }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[upload-evidence] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
