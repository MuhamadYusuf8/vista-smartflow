import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

/**
 * GET  /api/settings  — Ambil semua pengaturan dari DB
 * POST /api/settings  — Simpan pengaturan (Admin only)
 * PUT  /api/settings  — Test koneksi E-TLE
 */

const DEFAULTS: Record<string, string> = {
  confidence_threshold: "85",
  parking_duration_threshold: "300",
  ai_model_version: "YOLOv8s-v2.0",
  etle_endpoint: "https://api.etle.korlantas.polri.go.id/v1/sync",
  etle_api_key: "",
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at, updated_by");

    if (error) throw error;

    const settings: Record<string, string> = { ...DEFAULTS };
    (data ?? []).forEach((row) => {
      settings[row.key] = row.value;
    });

    return NextResponse.json({ settings, _source: "DB_LIVE" });
  } catch {
    return NextResponse.json({ settings: DEFAULTS, _source: "DEFAULT_FALLBACK" });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Admin only." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { settings } = body as { settings: Record<string, string> };
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const upsertData = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: now,
      updated_by: session.user.email ?? session.user.id,
    }));

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(upsertData, { onConflict: "key" });

    if (error) throw error;

    await logAudit({
      event: "SETTINGS_CHANGED",
      userId: session.user.id,
      userEmail: session.user.email ?? undefined,
      details: `Pengaturan diubah: ${Object.keys(settings).join(", ")}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, updated: Object.keys(settings).length });
  } catch (err) {
    console.error("[settings POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  try {
    const { endpoint, apiKey } = await req.json();
    const testUrl = endpoint || DEFAULTS.etle_endpoint;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let status = "UNKNOWN";
    let latencyMs = 0;

    try {
      const start = Date.now();
      const res = await fetch(testUrl, {
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: controller.signal,
      });
      latencyMs = Date.now() - start;
      status = [200, 401, 403, 404].includes(res.status) ? "REACHABLE" : "ERROR";
    } catch (e) {
      status = (e as Error).name === "AbortError" ? "TIMEOUT" : "UNREACHABLE";
    } finally {
      clearTimeout(timeout);
    }

    return NextResponse.json({ status, latencyMs, endpoint: testUrl });
  } catch {
    return NextResponse.json({ error: "Test gagal" }, { status: 500 });
  }
}
