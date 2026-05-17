import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fmt = searchParams.get("format"); // csv | pdf
    const status = searchParams.get("status") ?? "VERIFIED"; // default export verified
    const days = parseInt(searchParams.get("days") ?? "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const TYPE_LABELS: Record<string, string> = {
      ILLEGAL_PARKING: "Parkir Liar",
      BUSWAY_VIOLATION: "Jalur Busway",
      BICYCLE_LANE_VIOLATION: "Jalur Sepeda",
      BUS_STOP_VIOLATION: "Halte Bus",
      WRONG_LANE: "Salah Lajur",
    };

    const STATUS_LABELS: Record<string, string> = {
      PENDING: "Menunggu",
      VERIFIED: "Terverifikasi",
      EXPORTED: "Terkirim E-TLE",
      DISMISSED: "Ditolak",
    };

    // Fetch real data from Supabase
    let query = supabase
      .from("violations")
      .select("id, license_plate, type, vehicle_type, location, confidence, duration, status, timestamp, etle_ref")
      .gte("timestamp", startDate.toISOString())
      .order("timestamp", { ascending: false });

    if (status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const violations = data ?? [];

    if (fmt === "csv") {
      const header = [
        "ID",
        "Plat Nomor",
        "Jenis Pelanggaran",
        "Jenis Kendaraan",
        "Lokasi",
        "Confidence AI",
        "Durasi (detik)",
        "Status",
        "Waktu Deteksi",
        "Referensi E-TLE",
      ].join(",");

      const rows = violations.map((v) => {
        const conf = Math.round(v.confidence * 100);
        const ts = new Date(v.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
        const dur = v.duration ?? "-";
        const etle = v.etle_ref ?? "-";
        // Escape commas in fields
        const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
        return [
          escape(v.id.slice(0, 8).toUpperCase()),
          escape(v.license_plate),
          escape(TYPE_LABELS[v.type] ?? v.type),
          escape(v.vehicle_type),
          escape(v.location),
          `${conf}%`,
          dur,
          escape(STATUS_LABELS[v.status] ?? v.status),
          escape(ts),
          escape(etle),
        ].join(",");
      });

      const csv = [header, ...rows].join("\n");
      const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility

      return new NextResponse(bom + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pelanggaran_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    if (fmt === "pdf") {
      // Build a simple HTML-based PDF content for jsPDF on client side isn't available server-side
      // Instead, return a detailed HTML report that browser can print as PDF
      const reportDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      });

      const rows = violations
        .slice(0, 100) // limit to 100 for PDF
        .map((v, i) => {
          const conf = Math.round(v.confidence * 100);
          const ts = new Date(v.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
          return `
            <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${v.id.slice(0, 8).toUpperCase()}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;">${v.license_plate}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;">${TYPE_LABELS[v.type] ?? v.type}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;">${v.location}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;">${conf}%</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;">${STATUS_LABELS[v.status] ?? v.status}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;">${ts}</td>
            </tr>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Laporan Pelanggaran VISTA SmartFlow AI</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 24px; }
  .logo { font-size: 22px; font-weight: 800; color: #1e40af; letter-spacing: -0.5px; }
  .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
  .meta { display: flex; gap: 32px; margin: 20px 0; }
  .meta-item { }
  .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  thead { background: #1e40af; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; color: white; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">🚦 VISTA SmartFlow AI</div>
  <div class="subtitle">Laporan Pelanggaran Lalu Lintas — Dishub DKI Jakarta</div>
</div>
<div class="meta">
  <div class="meta-item"><div class="meta-label">Tanggal Laporan</div><div class="meta-value">${reportDate}</div></div>
  <div class="meta-item"><div class="meta-label">Total Data</div><div class="meta-value">${violations.length}</div></div>
  <div class="meta-item"><div class="meta-label">Periode</div><div class="meta-value">${days} Hari Terakhir</div></div>
  <div class="meta-item"><div class="meta-label">Filter Status</div><div class="meta-value">${STATUS_LABELS[status] ?? status}</div></div>
</div>
<table>
  <thead>
    <tr>
      <th>ID Ref</th>
      <th>Plat Nomor</th>
      <th>Jenis Pelanggaran</th>
      <th>Lokasi</th>
      <th>Confidence</th>
      <th>Status</th>
      <th>Waktu Deteksi</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
${violations.length > 100 ? `<p style="margin-top:12px;font-size:12px;color:#64748b;">*Menampilkan 100 dari ${violations.length} data. Gunakan ekspor CSV untuk data lengkap.</p>` : ""}
<div class="footer">
  Digenerate oleh VISTA SmartFlow AI System • ${reportDate} • Dishub DKI Jakarta
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="laporan_pelanggaran_${new Date().toISOString().slice(0, 10)}.html"`,
        },
      });
    }

    return NextResponse.json({ error: "Format tidak valid. Gunakan ?format=csv atau ?format=pdf" }, { status: 400 });
  } catch (error) {
    console.error("[Export Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
