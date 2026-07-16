/**
 * VISTA SmartFlow AI — Demo Data Seeder
 * ======================================
 * Mengisi database dengan data realistis untuk keperluan demo kompetisi.
 * Meliputi:
 *   - 6 kamera CCTV di titik-titik strategis Jakarta
 *   - 500+ pelanggaran tersebar 7 hari terakhir
 *   - 300+ vehicle sightings (untuk Vehicle Tracking)
 *   - 7 hari traffic_metrics per jam (untuk Traffic Forecast & ERP)
 *   - 20+ citizen reports
 *
 * Cara jalankan:
 *   npx tsx scripts/seed-demo.ts
 *
 * PERINGATAN: Script ini akan INSERT data baru. Jalankan hanya sekali atau
 * gunakan --clear flag untuk membersihkan data demo sebelum seeding ulang.
 */

import { createClient } from "@supabase/supabase-js";

// Gunakan variabel environment langsung — jalankan dari root project
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// DATA REFERENSI
// ============================================================

const CAMERAS = [
  { id: undefined, name: "CCTV Bundaran HI",        location: "Bundaran HI, Jl. MH Thamrin",           lat: -6.1947,  lng: 106.8230 },
  { id: undefined, name: "CCTV Sudirman Semanggi",  location: "Jl. Jend. Sudirman — Semanggi",          lat: -6.2231,  lng: 106.8041 },
  { id: undefined, name: "CCTV Gatot Subroto",      location: "Jl. Gatot Subroto — Kuningan",           lat: -6.2307,  lng: 106.8232 },
  { id: undefined, name: "CCTV Monas Selatan",      location: "Jl. Medan Merdeka Selatan",              lat: -6.1754,  lng: 106.8272 },
  { id: undefined, name: "CCTV Thamrin Plaza",      location: "Jl. MH Thamrin — Grand Indonesia",       lat: -6.1920,  lng: 106.8225 },
  { id: undefined, name: "CCTV Casablanca",         location: "Jl. Casablanca — Mal Ambassador",        lat: -6.2270,  lng: 106.8390 },
];

const VIOLATION_TYPES = [
  "ILLEGAL_PARKING", "BUSWAY_VIOLATION", "BICYCLE_LANE_VIOLATION",
  "BUS_STOP_VIOLATION", "WRONG_LANE",
] as const;

const PLATE_PREFIXES  = ["B", "B", "B", "B", "D", "F", "Z", "B"];
const PLATE_NUMBERS   = ["1234", "5678", "9012", "3456", "7890", "2468", "1357", "8421", "6543", "2109"];
const PLATE_SUFFIXES  = ["ABC", "DEF", "GHI", "JKL", "MNO", "PQR", "XYZ", "WVU", "TSR", "QPO"];
const VEHICLE_TYPES   = ["CAR", "CAR", "CAR", "MOTORCYCLE", "MOTORCYCLE", "BUS", "TRUCK"];
const VIOLATION_STATUS = ["PENDING", "PENDING", "PENDING", "VERIFIED", "VERIFIED", "EXPORTED", "DISMISSED"] as const;

const DIRECTIONS = ["Utara", "Selatan", "Timur", "Barat"];

function rng(seed: number) {
  // Simple seeded pseudo-random (mulberry32)
  let s = seed;
  return () => { s |= 0; s = s + 0x6d2b79f5 | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff; };
}

function randomPlate(r: () => number): string {
  return `${PLATE_PREFIXES[Math.floor(r() * PLATE_PREFIXES.length)]} ${PLATE_NUMBERS[Math.floor(r() * PLATE_NUMBERS.length)]} ${PLATE_SUFFIXES[Math.floor(r() * PLATE_SUFFIXES.length)]}`;
}

// ============================================================
// MAIN SEEDER
// ============================================================

async function seed() {
  const clearFlag = process.argv.includes("--clear");
  const r = rng(42);

  console.log("🌱 VISTA Demo Seeder mulai...\n");

  // ── Step 1: Upsert cameras ──
  console.log("📷 Step 1: Seeding cameras...");
  const cameraRows = CAMERAS.map((c) => ({
    name: c.name, location: c.location, lat: c.lat, lng: c.lng, status: "ACTIVE",
  }));
  const { data: existingCams } = await supabase.from("cameras").select("id, name");
  const camIds: Record<string, string> = {};

  for (const cam of cameraRows) {
    const existing = existingCams?.find((e) => e.name === cam.name);
    if (existing) {
      camIds[cam.name] = existing.id;
      console.log(`  ✓ Kamera sudah ada: ${cam.name}`);
    } else {
      const { data, error } = await supabase.from("cameras").insert(cam).select("id, name").single();
      if (error) { console.error(`  ✗ Error insert camera ${cam.name}:`, error.message); continue; }
      camIds[cam.name] = data.id;
      console.log(`  + Ditambahkan: ${cam.name}`);
    }
  }
  const camIdList = Object.values(camIds);
  if (camIdList.length === 0) { console.error("❌ Tidak ada kamera tersedia. Hentikan."); process.exit(1); }

  // ── Step 2: Seed violations (7 hari terakhir) ──
  console.log("\n🚨 Step 2: Seeding violations (500 data)...");
  if (clearFlag) {
    const { error } = await supabase.from("violations").delete().like("location", "%Jl.%");
    if (!error) console.log("  🗑️  Data violations lama dihapus.");
  }

  const violationBatch = [];
  const now = Date.now();
  for (let i = 0; i < 500; i++) {
    const daysAgo = r() * 7;
    const ts = new Date(now - daysAgo * 86400000);

    // Lebih banyak pelanggaran di jam sibuk
    const hour = ts.getHours();
    const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);

    const camName = CAMERAS[Math.floor(r() * CAMERAS.length)].name;
    const camId   = camIds[camName];
    const camData = CAMERAS.find((c) => c.name === camName)!;
    const vtype   = VIOLATION_TYPES[Math.floor(r() * VIOLATION_TYPES.length)];
    const vstatus = VIOLATION_STATUS[Math.floor(r() * VIOLATION_STATUS.length)];
    const plate   = randomPlate(r);
    const vehType = VEHICLE_TYPES[Math.floor(r() * VEHICLE_TYPES.length)];

    violationBatch.push({
      camera_id:     camId,
      type:          vtype,
      license_plate: plate,
      vehicle_type:  vehType,
      confidence:    0.75 + r() * 0.24,
      duration:      vtype === "ILLEGAL_PARKING" ? Math.floor(60 + r() * 600) : null,
      location:      camData.location,
      lat:           camData.lat + (r() - 0.5) * 0.001,
      lng:           camData.lng + (r() - 0.5) * 0.001,
      status:        vstatus,
      timestamp:     ts.toISOString(),
      etle_ref:      vstatus === "EXPORTED"
        ? `ETLE-${i.toString(36).toUpperCase()}-${Math.floor(r() * 9999).toString().padStart(4, "0")}`
        : null,
    });
  }

  // Insert dalam batch 50
  let violInserted = 0;
  for (let i = 0; i < violationBatch.length; i += 50) {
    const chunk = violationBatch.slice(i, i + 50);
    const { error } = await supabase.from("violations").insert(chunk);
    if (error) console.error(`  ✗ Batch ${i/50} error:`, error.message);
    else violInserted += chunk.length;
  }
  console.log(`  ✅ ${violInserted} violations berhasil di-seed.`);

  // ── Step 3: Seed vehicle_sightings ──
  console.log("\n👁  Step 3: Seeding vehicle_sightings (300 data)...");
  if (clearFlag) {
    await supabase.from("vehicle_sightings").delete().gte("created_at", new Date(0).toISOString());
  }

  const sightingBatch = [];
  // Pilih 30 plat yang akan punya riwayat tracking menarik
  const trackingPlates = Array.from({ length: 30 }, (_, i) => randomPlate(rng(i * 17)));

  for (let i = 0; i < 300; i++) {
    const plate     = trackingPlates[Math.floor(r() * trackingPlates.length)];
    const camName   = CAMERAS[Math.floor(r() * CAMERAS.length)].name;
    const camId     = camIds[camName];
    const hoursAgo  = r() * 72;
    const ts        = new Date(now - hoursAgo * 3600000);
    const isFlagged = i < 50; // 50 sighting pertama dari kendaraan yang banyak pelanggaran

    sightingBatch.push({
      license_plate: plate,
      camera_id:     camId,
      vehicle_type:  VEHICLE_TYPES[Math.floor(r() * 3)] as string,
      confidence:    0.78 + r() * 0.21,
      speed_kmh:     15 + r() * 65,
      direction:     DIRECTIONS[Math.floor(r() * DIRECTIONS.length)],
      is_flagged:    isFlagged,
      flag_reason:   isFlagged ? "Kendaraan dalam daftar pantau VISTA (3+ pelanggaran)" : null,
      created_at:    ts.toISOString(),
    });
  }

  let sightInserted = 0;
  for (let i = 0; i < sightingBatch.length; i += 50) {
    const { error } = await supabase.from("vehicle_sightings").insert(sightingBatch.slice(i, i + 50));
    if (error) console.error(`  ✗ Sighting batch ${i/50} error:`, error.message);
    else sightInserted += 50;
  }
  console.log(`  ✅ ${sightInserted} vehicle sightings berhasil di-seed.`);

  // ── Step 4: Seed traffic_metrics (7 hari × 24 jam × 6 kamera) ──
  console.log("\n📊 Step 4: Seeding traffic_metrics (7 hari × 24 jam × 6 kamera)...");
  if (clearFlag) {
    await supabase.from("traffic_metrics").delete().gte("recorded_at", new Date(0).toISOString());
  }

  // Profil kemacetan per jam (0–23): tinggi di jam sibuk
  const CONGESTION_PROFILE = [
    0.1, 0.1, 0.1, 0.1, 0.1, 0.15, 0.25, 0.85, // 00-07
    0.90, 0.75, 0.55, 0.45, 0.40, 0.40, 0.45, 0.55, // 08-15
    0.88, 0.92, 0.80, 0.60, 0.45, 0.30, 0.20, 0.12, // 16-23
  ];

  const trafficBatch = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const camName of Object.keys(camIds)) {
      const camId = camIds[camName];
      for (let hour = 0; hour < 24; hour++) {
        const date    = new Date(now - dayOffset * 86400000);
        date.setHours(hour, 0, 0, 0);
        const baseCongest = CONGESTION_PROFILE[hour];
        const noise       = (r() - 0.5) * 0.1;
        const congestion  = Math.max(0, Math.min(1, baseCongest + noise));
        const vehicleCount = Math.round(2 + congestion * 28 + r() * 5);
        const avgSpeed     = Math.round(60 - congestion * 50 + r() * 10);

        trafficBatch.push({
          camera_id:     camId,
          recorded_at:   date.toISOString(),
          vehicle_count: vehicleCount,
          avg_speed_kmh: avgSpeed,
          congestion:    Math.round(congestion * 100) / 100,
        });
      }
    }
  }

  let trafficInserted = 0;
  for (let i = 0; i < trafficBatch.length; i += 100) {
    const { error } = await supabase.from("traffic_metrics").insert(trafficBatch.slice(i, i + 100));
    if (error) console.error(`  ✗ Traffic batch ${i/100} error:`, error.message);
    else trafficInserted += 100;
  }
  console.log(`  ✅ ${Math.min(trafficInserted, trafficBatch.length)} traffic metrics berhasil di-seed.`);

  // ── Step 5: Seed citizen_reports ──
  console.log("\n📱 Step 5: Seeding citizen_reports (20 data)...");
  const REPORT_TYPES    = ["ILLEGAL_PARKING", "BUSWAY_VIOLATION", "BICYCLE_LANE_VIOLATION", "BUS_STOP_VIOLATION"];
  const REPORTERS       = ["Budi Santoso", "Dewi Rahayu", "Ahmad Fauzi", "Siti Nurhaliza", "Anonim", "Anonim", "Anonim"];
  const REPORT_STATUSES = ["AI_REVIEW", "AI_REVIEW", "APPROVED", "REJECTED"];

  const reportBatch = CAMERAS.flatMap((cam) =>
    Array.from({ length: 3 }, (_, i) => ({
      id:             `RPT-${Date.now().toString(36)}-${i}-${cam.name.slice(0, 3).replace(/\s/g, "")}`,
      violation_type: REPORT_TYPES[Math.floor(r() * REPORT_TYPES.length)],
      location:       cam.location,
      description:    `Kendaraan melanggar di ${cam.location} — dilaporkan warga.`,
      reporter:       REPORTERS[Math.floor(r() * REPORTERS.length)],
      ai_confidence:  0.55 + r() * 0.4,
      status:         REPORT_STATUSES[Math.floor(r() * REPORT_STATUSES.length)],
      lat:            cam.lat + (r() - 0.5) * 0.002,
      lng:            cam.lng + (r() - 0.5) * 0.002,
      source:         "JAKI",
      submitted_at:   new Date(now - r() * 7 * 86400000).toISOString(),
    }))
  );

  const { error: rpError } = await supabase.from("citizen_reports").insert(reportBatch);
  if (rpError) console.error("  ✗ Citizen reports error:", rpError.message);
  else console.log(`  ✅ ${reportBatch.length} citizen reports berhasil di-seed.`);

  // ── Summary ──
  console.log("\n" + "=".repeat(55));
  console.log("✅ SEEDER SELESAI! Database siap untuk demo.");
  console.log("=".repeat(55));
  console.log(`
  📷 Cameras:          ${camIdList.length} kamera aktif
  🚨 Violations:       500 data (7 hari terakhir)
  👁  Vehicle Sightings: 300 sighting (72 jam terakhir)
  📊 Traffic Metrics:  ${7 * 24 * camIdList.length} data poin (7 hari × 24 jam)
  📱 Citizen Reports:  ${reportBatch.length} laporan warga
  `);
  console.log("💡 Jalankan 'npm run dev' lalu buka dashboard untuk melihat hasilnya.");
}

seed().catch((err) => {
  console.error("❌ Seeder gagal:", err);
  process.exit(1);
});
