import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { getAuthSession } from "@/lib/auth";

/**
 * GET /api/violations/[id]
 * Mendapatkan detail satu pelanggaran.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const { data, error } = await supabase
      .from("violations")
      .select("*, cameras(*)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Pelanggaran tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/violations/[id]
 * Update status pelanggaran (VERIFIED, DISMISSED, EXPORTED).
 * Dilengkapi audit trail, Telegram notifikasi, dan auto-generate ETLE ref.
 */

// State machine — transisi yang diizinkan
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING:   ["VERIFIED", "DISMISSED"],
  VERIFIED:  ["EXPORTED", "DISMISSED"],
  EXPORTED:  ["VERIFIED"],   // hanya Admin (rollback)
  DISMISSED: ["PENDING"],    // Admin bisa re-open
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (session.user?.role === "VIEWER") {
    return NextResponse.json(
      { error: "Akses ditolak. Hanya ADMIN dan OFFICER yang dapat mengubah status pelanggaran." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { status } = body;

    const validStatuses = ["VERIFIED", "DISMISSED", "EXPORTED", "PENDING"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Ambil status saat ini untuk validasi transisi
    const { data: existing } = await supabase
      .from("violations")
      .select("status, license_plate, etle_ref, cameras(name, location)")
      .eq("id", id)
      .single();

    const currentStatus = existing?.status ?? "PENDING";
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(status)) {
      return NextResponse.json({
        error: `Tidak dapat mengubah status dari '${currentStatus}' ke '${status}'.`,
        currentStatus,
        allowedTransitions: allowed,
      }, { status: 400 });
    }

    // Hanya Admin yang bisa rollback dari EXPORTED
    if (currentStatus === "EXPORTED" && session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Hanya ADMIN yang dapat membatalkan status EXPORTED." }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      status,
      processed_at: new Date().toISOString(),
    };

    // Generate ETLE reference jika di-export dan belum ada
    if (status === "EXPORTED" && !existing?.etle_ref) {
      updateData.etle_ref = `ETLE-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
    }

    const { data, error } = await supabase
      .from("violations")
      .update(updateData)
      .eq("id", id)
      .select("*, cameras(*)")
      .single();

    if (error) throw error;

    // Catat ke Audit Trail
    const auditEventMap: Record<string, "VIOLATION_VERIFIED" | "VIOLATION_DISMISSED" | "DATA_SYNC_ETLE" | "SETTINGS_CHANGED"> = {
      VERIFIED:  "VIOLATION_VERIFIED",
      DISMISSED: "VIOLATION_DISMISSED",
      EXPORTED:  "DATA_SYNC_ETLE",
      PENDING:   "SETTINGS_CHANGED",
    };

    logAudit({
      event: auditEventMap[status] ?? "SETTINGS_CHANGED",
      userId: session.user?.id,
      userEmail: session.user?.email ?? undefined,
      targetId: id,
      details: `Status diubah ${currentStatus} → ${status} oleh ${session.user?.name ?? session.user?.email}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
    });

    // Telegram alert saat VERIFIED atau EXPORTED (fire-and-forget)
    if ((status === "VERIFIED" || status === "EXPORTED") && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const camera = data.cameras as { name: string; location: string } | null;
      const statusEmoji = status === "EXPORTED" ? "📤" : "✅";
      const caption = `${statusEmoji} *PELANGGARAN ${status}*\n🚗 Plat: \`${data.license_plate}\`\n📍 ${camera?.location ?? data.location}\n🔖 Ref: \`${(data.etle_ref ?? data.id.slice(0, 8)).toUpperCase()}\``;

      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: caption, parse_mode: "Markdown" }),
      }).catch(() => {});
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}