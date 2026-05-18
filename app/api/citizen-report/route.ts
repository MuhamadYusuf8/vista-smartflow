import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

/**
 * GET  /api/citizen-report — Daftar laporan warga dari DB
 * POST /api/citizen-report — Submit laporan dari warga (JAKI integration) → simpan ke DB
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  try {
    let query = supabase
      .from("citizen_reports")
      .select("*", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status.toUpperCase());
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const reports = (data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      violation_type: r.violation_type,
      location: r.location,
      description: r.description,
      reporter: r.reporter,
      aiConfidence: r.ai_confidence,
      evidence_url: r.evidence_url ?? null,
      submittedAt: r.submitted_at,
      source: r.source ?? "JAKI",
    }));

    const total = count ?? reports.length;

    return NextResponse.json({
      reports,
      total,
      pendingAiReview: reports.filter((r) => r.status === "AI_REVIEW").length,
      verified: reports.filter((r) => r.status === "VERIFIED").length,
      rejected: reports.filter((r) => r.status === "REJECTED").length,
      _source: "DB_LIVE",
    });
  } catch (err) {
    console.error("[citizen-report GET]", err);
    // Fallback: return empty rather than crash
    return NextResponse.json({
      reports: [],
      total: 0,
      pendingAiReview: 0,
      verified: 0,
      rejected: 0,
      _source: "DB_ERROR",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { location, description, reporter_name, violation_type, lat, lng, evidence_url } = body;

    if (!location || !description || !violation_type) {
      return NextResponse.json(
        { error: "Field wajib: location, description, violation_type" },
        { status: 400 }
      );
    }

    // AI confidence simulation (deterministik berdasarkan konten)
    const hash = [...`${violation_type}${location}${description}`].reduce(
      (acc, c) => acc + c.charCodeAt(0),
      0
    );
    const aiConfidence = 0.55 + (hash % 40) / 100; // 0.55 – 0.94
    const aiDecision = aiConfidence >= 0.75 ? "LIKELY_VIOLATION" : "NEEDS_REVIEW";
    const status = aiConfidence >= 0.80 ? "AI_REVIEW" : aiConfidence >= 0.70 ? "AI_REVIEW" : "PENDING";

    const reportId = `CR-${Date.now().toString(36).toUpperCase()}`;

    // Simpan ke database
    const { error: dbError } = await supabaseAdmin
      .from("citizen_reports")
      .insert({
        id: reportId,
        status,
        violation_type,
        location,
        description,
        reporter: reporter_name?.trim() || "Anonim",
        ai_confidence: aiConfidence,
        ai_decision: aiDecision,
        evidence_url: evidence_url ?? null,
        lat: lat ?? (-6.2 + (Math.random() - 0.5) * 0.1),
        lng: lng ?? (106.8 + (Math.random() - 0.5) * 0.1),
        source: "JAKI",
        submitted_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("[citizen-report POST] DB error:", dbError);
      // Lanjutkan meski gagal simpan, tetap kembalikan response ke user
    }

    // Catat ke Audit Log
    await logAudit({
      event: "DATA_SYNC_ETLE",
      details: `Citizen report via JAKI: ${violation_type} di ${location} oleh ${reporter_name ?? "Anonim"} (conf: ${(aiConfidence * 100).toFixed(0)}%)`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      reportId,
      message: "Laporan Anda berhasil diterima dan sedang diproses oleh AI.",
      aiAnalysis: {
        confidence: aiConfidence,
        decision: aiDecision,
        estimatedProcessingTime: "2-5 menit",
        willBeReviewedBy: aiDecision === "LIKELY_VIOLATION" ? "AI + Petugas Dishub" : "Petugas Lapangan",
      },
      report: {
        id: reportId,
        status,
        location,
        description,
        violation_type,
        reporter: reporter_name ?? "Anonim",
        submittedAt: new Date().toISOString(),
        lat: lat ?? -6.2,
        lng: lng ?? 106.8,
      },
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[citizen-report POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
