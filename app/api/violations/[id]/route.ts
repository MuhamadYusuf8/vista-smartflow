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
 * Fase 2: Menambahkan Audit Trail untuk setiap perubahan status.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // VIEWER tidak boleh mengubah status
  if (session.user?.role === "VIEWER") {
    return NextResponse.json(
      { error: "Akses ditolak. Hanya ADMIN dan OFFICER yang dapat mengubah status pelanggaran." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { status } = body;

    const validStatuses = ["VERIFIED", "DISMISSED", "EXPORTED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status tidak valid. Harus salah satu dari: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      processed_at: new Date().toISOString(),
    };

    if (status === "EXPORTED") {
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
    const auditEventMap: Record<string, "VIOLATION_VERIFIED" | "VIOLATION_DISMISSED" | "VIOLATION_EXPORTED"> = {
      VERIFIED: "VIOLATION_VERIFIED",
      DISMISSED: "VIOLATION_DISMISSED",
      EXPORTED: "VIOLATION_EXPORTED",
    };

    logAudit({
      event: auditEventMap[status],
      userId: session.user?.id,
      userEmail: session.user?.email ?? undefined,
      targetId: id,
      details: `Status diubah menjadi ${status} oleh ${session.user?.name ?? session.user?.email}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}