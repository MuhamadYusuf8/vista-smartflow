import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// ── Data seed realistis Jakarta ──

const VIOLATION_HOTSPOTS = [
  // Zona Sudirman - Senayan
  { location: "Jl. Jend. Sudirman — Senayan Gate", lat: -6.2188, lng: 106.8003, weight: 0.9 },
  { location: "Jl. Jend. Sudirman — BNI 46", lat: -6.2122, lng: 106.8100, weight: 0.85 },
  { location: "SCBD — Jl. Jend. Sudirman", lat: -6.2264, lng: 106.8080, weight: 0.8 },
  // Zona Semanggi - Gatot Subroto
  { location: "Jl. Gatot Subroto — Semanggi", lat: -6.2087, lng: 106.8182, weight: 1.0 },
  { location: "Jl. Gatot Subroto — Kuningan", lat: -6.2199, lng: 106.8291, weight: 0.75 },
  // Zona Bundaran HI - Thamrin
  { location: "Bundaran HI", lat: -6.1944, lng: 106.8229, weight: 0.9 },
  { location: "Jl. MH Thamrin — Grand Indonesia", lat: -6.1938, lng: 106.8213, weight: 0.7 },
  // Zona Casablanca - Rasuna
  { location: "Jl. Casablanca — Kokas", lat: -6.2254, lng: 106.8322, weight: 0.85 },
  { location: "Jl. HR Rasuna Said — Kuningan", lat: -6.2300, lng: 106.8350, weight: 0.7 },
  // Zona Tanah Abang
  { location: "Pasar Tanah Abang — Blok A", lat: -6.1864, lng: 106.8126, weight: 1.0 },
  { location: "Jl. KS Tubun — Tanah Abang", lat: -6.1920, lng: 106.8050, weight: 0.75 },
  // Zona Kemang - Mampang
  { location: "Jl. Kemang Raya", lat: -6.2615, lng: 106.8106, weight: 0.65 },
  { location: "Jl. Mampang Prapatan", lat: -6.2459, lng: 106.8303, weight: 0.6 },
  // Zona Pasar Minggu
  { location: "Jl. Raya Pasar Minggu", lat: -6.2887, lng: 106.8412, weight: 0.55 },
  // Zona Pluit - Penjaringan
  { location: "Jl. Pluit Raya", lat: -6.1184, lng: 106.8012, weight: 0.6 },
  // Zona Kelapa Gading
  { location: "Jl. Boulevard Kelapa Gading", lat: -6.1556, lng: 106.9123, weight: 0.65 },
  // Zona Cawang - Kampung Melayu
  { location: "Jl. MT Haryono — Cawang", lat: -6.2450, lng: 106.8700, weight: 0.7 },
  { location: "Simpang Cawang", lat: -6.2417, lng: 106.8659, weight: 0.75 },
  // Zona Grogol - Slipi
  { location: "Jl. Daan Mogot — Grogol", lat: -6.1680, lng: 106.7957, weight: 0.6 },
  { location: "Jl. S Parman — Slipi", lat: -6.1850, lng: 106.7920, weight: 0.65 },
];

const VIOLATION_TYPES = [
  { type: "ILLEGAL_PARKING", label: "Parkir Liar", weight: 0.35 },
  { type: "BUSWAY_VIOLATION", label: "Masuk Jalur Busway", weight: 0.25 },
  { type: "WRONG_LANE", label: "Salah Lajur", weight: 0.18 },
  { type: "BICYCLE_LANE_VIOLATION", label: "Masuk Jalur Sepeda", weight: 0.12 },
  { type: "BUS_STOP_VIOLATION", label: "Berhenti di Halte", weight: 0.10 },
];

const PLATE_PREFIXES = ["B", "B", "B", "B", "B", "D", "F", "Z"];
const PLATE_NUMS = ["1234","5678","9012","3456","7890","2468","1357","8024","6543","4321","9876","1111","2222","3333","4444","5555"];
const PLATE_SUFFIX = ["ABC","DEF","GHI","JKL","MNO","PQR","STU","VWX","YZA","BCD","EFG","HIJ","KLM","NOP","QRS","TUV"];

function randomPlate(seed: number): string {
  const p = PLATE_PREFIXES[seed % PLATE_PREFIXES.length];
  const n = PLATE_NUMS[seed % PLATE_NUMS.length];
  const s = PLATE_SUFFIX[(seed * 7) % PLATE_SUFFIX.length];
  return `${p} ${n} ${s}`;
}

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomTimestamp(daysBack: number): string {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  const ts = past + Math.random() * (now - past);
  // Bias toward rush hours
  const d = new Date(ts);
  const h = d.getHours();
  // Rush hour bias: 60% of violations during 6-10 and 16-21
  if (Math.random() < 0.6) {
    const rushHours = [6,7,8,9,10,16,17,18,19,20];
    const rh = rushHours[Math.floor(Math.random() * rushHours.length)];
    d.setHours(rh, Math.floor(Math.random() * 60));
  }
  return d.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(body.count ?? 300, 500);
    const daysBack = body.days ?? 30;

    const violations = [];
    for (let i = 0; i < count; i++) {
      const hotspot = weightedRandom(VIOLATION_HOTSPOTS);
      const vtype = weightedRandom(VIOLATION_TYPES);
      const status = Math.random() < 0.35 ? "VERIFIED" : Math.random() < 0.1 ? "EXPORTED" : "PENDING";

      // Jitter koordinat ±200m
      const lat = hotspot.lat + (Math.random() - 0.5) * 0.004;
      const lng = hotspot.lng + (Math.random() - 0.5) * 0.004;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v: Record<string, any> = {
        type: vtype.type,
        license_plate: randomPlate(i * 13 + Math.floor(Math.random() * 100)),
        vehicle_type: Math.random() < 0.7 ? "CAR" : Math.random() < 0.5 ? "MOTORCYCLE" : "TRUCK",
        confidence: Math.round((0.75 + Math.random() * 0.24) * 1000) / 1000,
        location: hotspot.location,
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
        status,
        timestamp: randomTimestamp(daysBack),
      };

      // Only add optional fields when they have values
      if (status !== "PENDING") {
        v.evidence_url = `https://storage.example.com/evidence/ev_${i}_${Date.now()}.jpg`;
      }
      if (status === "EXPORTED") {
        v.etle_ref = `ETLE-JKT-${new Date().getFullYear()}-${String(i).padStart(6, "0")}`;
        v.processed_at = new Date().toISOString();
      }

      violations.push(v);
    }

    // Insert in batches of 50
    const batchSize = 50;
    let inserted = 0;
    for (let i = 0; i < violations.length; i += batchSize) {
      const batch = violations.slice(i, i + batchSize);
      const { error } = await supabaseAdmin.from("violations").insert(batch);
      if (error) {
        console.error("Insert batch error:", JSON.stringify(error));
        return NextResponse.json({
          success: false,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          sample: batch[0],
        }, { status: 500 });
      }
      inserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: `✅ Berhasil insert ${inserted} violations ke Supabase`,
      inserted,
      locations: VIOLATION_HOTSPOTS.length,
      daysBack,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : JSON.stringify(err),
    }, { status: 500 });
  }
}

export async function GET() {
  // Check current count
  const { count } = await supabaseAdmin
    .from("violations")
    .select("*", { count: "exact", head: true });
  return NextResponse.json({ total_violations: count ?? 0 });
}
