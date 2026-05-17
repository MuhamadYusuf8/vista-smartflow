import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/samsat?plate=B+1234+CD
 * Simulasi API data kendaraan dari Samsat / Korlantas.
 * Fase 2: Integrasi Data Kendaraan (Human-in-the-Loop).
 * 
 * Dalam implementasi nyata, ini akan memanggil API resmi Korlantas/Samsat.
 * Saat ini menggunakan data deterministik berbasis hash plat nomor.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate");

  if (!plate) {
    return NextResponse.json({ error: "Parameter 'plate' wajib diisi." }, { status: 400 });
  }

  // Simulasi delay jaringan seperti API eksternal nyata
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Generate data deterministik dari plat nomor
  // (agar konsisten setiap kali pencarian plat yang sama)
  const hash = hashPlate(plate);

  const owners = [
    "Budi Santoso", "Dewi Rahayu", "Ahmad Fauzi", "Siti Nurhaliza",
    "Rendra Kusuma", "Maya Indah", "Hendra Wijaya", "Lestari Putri",
    "Doni Prasetyo", "Rina Marlina",
  ];

  const brands = [
    "Toyota Avanza", "Honda Brio", "Yamaha NMAX", "Mitsubishi Xpander",
    "Daihatsu Terios", "Suzuki Ertiga", "Honda PCX", "Toyota Rush",
    "Hyundai Creta", "Wuling Cortez",
  ];

  const colors = ["Putih", "Hitam", "Silver", "Abu-abu", "Merah", "Biru"];
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

  const ownerName = owners[hash % owners.length];
  const brand = brands[(hash * 3) % brands.length];
  const color = colors[(hash * 7) % colors.length];
  const year = years[(hash * 11) % years.length];

  // Simulasi status pajak (80% lunas, 20% menunggak)
  const pajakLunas = hash % 5 !== 0;
  const pajakExpiry = new Date();
  pajakExpiry.setFullYear(pajakExpiry.getFullYear() + (pajakLunas ? 1 : -1));

  return NextResponse.json({
    plate,
    found: true,
    owner: {
      name: ownerName,
      // Masking data untuk privasi (tidak tampilkan full NIK)
      nik: `****-****-${String(hash).padStart(4, "0").slice(-4)}`,
      address: `Jl. ${brands[(hash * 5) % brands.length].split(" ")[0]} No. ${(hash % 200) + 1}, Jakarta`,
    },
    vehicle: {
      brand,
      color,
      year,
      type: brand.includes("NMAX") || brand.includes("PCX") ? "MOTORCYCLE" : "CAR",
      engine_cc: brand.includes("NMAX") ? 155 : brand.includes("PCX") ? 160 : 1500,
    },
    registration: {
      stnk_expiry: new Date(Date.now() + (hash % 365) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      pajak_expiry: pajakExpiry.toISOString().slice(0, 10),
      pajak_status: pajakLunas ? "LUNAS" : "MENUNGGAK",
      total_violations_history: hash % 8, // riwayat pelanggaran sebelumnya
    },
    // Penanda bahwa ini adalah data simulasi
    _source: "SAMSAT_MOCK_API_v1",
  });
}

/**
 * Simple deterministic hash dari string plat nomor.
 */
function hashPlate(plate: string): number {
  let hash = 0;
  for (let i = 0; i < plate.length; i++) {
    const char = plate.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
