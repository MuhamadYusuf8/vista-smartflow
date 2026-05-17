import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/audit-log
 * Mengambil daftar log aktivitas sistem (Admin only).
 * Menggunakan supabaseAdmin agar konsisten dengan seluruh codebase.
 */
export async function GET(req: NextRequest) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  if (session.user?.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Akses ditolak. Hanya ADMIN yang dapat melihat audit log." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
    const page = Math.max(parseInt(searchParams.get("page") ?? "1"), 1);
    const offset = (page - 1) * limit;

    // Ambil data dari tabel system_logs via Supabase
    const { data: logs, error, count } = await supabaseAdmin
      .from("SystemLog")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // Jika tabel belum ada atau nama tabel beda, coba format snake_case
      console.error("[audit-log] Supabase error:", error.message);

      // Fallback: coba nama tabel lain
      const fallback = await supabaseAdmin
        .from("system_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (fallback.error) {
        return NextResponse.json({
          logs: [],
          total: 0,
          page,
          totalPages: 0,
          _debug: `Tabel tidak ditemukan: ${error.message}`,
        });
      }

      const formatted = (fallback.data ?? []).map((log: Record<string, unknown>) => ({
        id: log.id,
        event: log.event,
        details: parseDetails(log.details as string | null),
        createdAt: log.created_at,
      }));

      return NextResponse.json({
        logs: formatted,
        total: fallback.count ?? 0,
        page,
        totalPages: Math.ceil((fallback.count ?? 0) / limit),
      });
    }

    const formatted = (logs ?? []).map((log: Record<string, unknown>) => ({
      id: log.id,
      event: log.event,
      details: parseDetails(log.details as string | null),
      createdAt: log.created_at,
    }));

    return NextResponse.json({
      logs: formatted,
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[audit-log] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseDetails(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { details: raw };
  }
}
