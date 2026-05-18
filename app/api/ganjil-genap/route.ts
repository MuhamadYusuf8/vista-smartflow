import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/ganjil-genap
 * Mengembalikan status kebijakan ganjil genap saat ini di Jakarta.
 * Termasuk: apakah aktif, zona pembatasan, dan validasi plat nomor.
 */

// Zona Ganjil-Genap resmi di Jakarta (koordinat batas)
const RESTRICTED_ZONES = [
  {
    id: "GG-SD",
    name: "Jl. Jend. Sudirman",
    description: "Dari Semanggi hingga Senayan",
    lat: -6.2231, lng: 106.8041,
    enforceStart: "06:00", enforceEnd: "10:00",
    enforceStart2: "16:00", enforceEnd2: "21:00",
  },
  {
    id: "GG-TH",
    name: "Jl. MH Thamrin",
    description: "Dari Bundaran Senayan hingga Bundaran HI",
    lat: -6.1920, lng: 106.8225,
    enforceStart: "06:00", enforceEnd: "10:00",
    enforceStart2: "16:00", enforceEnd2: "21:00",
  },
  {
    id: "GG-GS",
    name: "Jl. Gatot Subroto",
    description: "Dari Slipi hingga Pancoran",
    lat: -6.2307, lng: 106.8232,
    enforceStart: "06:00", enforceEnd: "10:00",
    enforceStart2: "16:00", enforceEnd2: "21:00",
  },
  {
    id: "GG-RS",
    name: "Jl. HR Rasuna Said",
    description: "Kuningan area",
    lat: -6.2155, lng: 106.8291,
    enforceStart: "06:00", enforceEnd: "10:00",
    enforceStart2: "16:00", enforceEnd2: "21:00",
  },
  {
    id: "GG-HI",
    name: "Bundaran HI",
    description: "Area Bundaran Hotel Indonesia",
    lat: -6.1947, lng: 106.8230,
    enforceStart: "06:00", enforceEnd: "10:00",
    enforceStart2: "16:00", enforceEnd2: "21:00",
  },
];

// Hari libur nasional Indonesia 2025-2026 (format: YYYY-MM-DD)
const HOLIDAYS = new Set([
  "2025-01-01", "2025-01-29", "2025-03-29", "2025-03-30", "2025-03-31",
  "2025-04-18", "2025-05-01", "2025-05-12", "2025-05-29", "2025-06-01",
  "2025-06-06", "2025-08-17", "2025-09-05", "2025-12-25",
  "2026-01-01", "2026-02-17", "2026-03-22", "2026-04-03", "2026-05-01",
  "2026-05-14", "2026-06-18", "2026-06-19", "2026-08-17", "2026-12-25",
]);

function getJakartaTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function isTimeInRange(now: Date, start: string, end: string): boolean {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
}

function isEnforced(now: Date): boolean {
  const dayOfWeek = now.getDay(); // 0=Minggu, 6=Sabtu
  const dateStr = now.toISOString().slice(0, 10);

  // Tidak aktif di weekend dan hari libur nasional
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (HOLIDAYS.has(dateStr)) return false;

  return (
    isTimeInRange(now, "06:00", "10:00") ||
    isTimeInRange(now, "16:00", "21:00")
  );
}

function isPlateViolating(plate: string, todayDate: number): boolean {
  // Ekstrak angka terakhir dari plat (e.g., "B 1234 CD" → 4 → genap)
  const digits = plate.replace(/\D/g, "");
  if (!digits) return false;
  const lastDigit = parseInt(digits[digits.length - 1]);
  const isEven = lastDigit % 2 === 0;
  const isOdd = !isEven;
  const dateIsOdd = todayDate % 2 !== 0;

  // Ganjil hari → genap plat melanggar. Genap hari → ganjil plat melanggar.
  return dateIsOdd ? isEven : isOdd;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate");

  const now = getJakartaTime();
  const enforced = isEnforced(now);
  const todayDate = now.getDate();
  const dateIsOdd = todayDate % 2 !== 0;
  const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][now.getDay()];
  const dateStr = now.toISOString().slice(0, 10);
  const isHoliday = HOLIDAYS.has(dateStr);

  // Tentukan sesi aktif
  let activeSession: "pagi" | "sore" | null = null;
  if (enforced) {
    if (isTimeInRange(now, "06:00", "10:00")) activeSession = "pagi";
    else if (isTimeInRange(now, "16:00", "21:00")) activeSession = "sore";
  }

  // Hitung menit sampai sesi berikutnya
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let minutesUntilNext: number | null = null;
  let nextSessionLabel = "";
  if (!enforced && !isHoliday && now.getDay() !== 0 && now.getDay() !== 6) {
    if (nowMin < 6 * 60) {
      minutesUntilNext = 6 * 60 - nowMin;
      nextSessionLabel = "Sesi Pagi (06:00)";
    } else if (nowMin >= 10 * 60 && nowMin < 16 * 60) {
      minutesUntilNext = 16 * 60 - nowMin;
      nextSessionLabel = "Sesi Sore (16:00)";
    }
  }

  const response: Record<string, unknown> = {
    timestamp: now.toISOString(),
    policy: {
      name: "Ganjil Genap Jakarta",
      isEnforced: enforced,
      isHoliday,
      day: dayName,
      date: todayDate,
      dateIsOdd,
      restrictedPlate: enforced ? (dateIsOdd ? "GENAP" : "GANJIL") : null,
      activeSession,
      nextSession: minutesUntilNext ? { label: nextSessionLabel, minutesUntil: minutesUntilNext } : null,
      sessions: [
        { label: "Pagi", start: "06:00", end: "10:00" },
        { label: "Sore", start: "16:00", end: "21:00" },
      ],
    },
    zones: RESTRICTED_ZONES,
    stats: {
      totalZones: RESTRICTED_ZONES.length,
      kmCoverage: 47, // km total ruas yang dibatasi
    },
  };

  // Validasi plat jika disediakan
  if (plate) {
    const isViolating = enforced && isPlateViolating(plate, todayDate);
    const digits = plate.replace(/\D/g, "");
    const lastDigit = digits ? parseInt(digits[digits.length - 1]) : null;

    response.plateCheck = {
      plate,
      lastDigit,
      plateIsEven: lastDigit !== null ? lastDigit % 2 === 0 : null,
      isViolating,
      reason: isViolating
        ? `Plat ${plate} (${lastDigit! % 2 === 0 ? "genap" : "ganjil"}) dilarang melintas pada tanggal ${todayDate} (${dateIsOdd ? "ganjil" : "genap"}) di zona Ganjil-Genap`
        : enforced
        ? `Plat ${plate} boleh melintas hari ini`
        : "Kebijakan Ganjil-Genap tidak aktif saat ini",
    };
  }

  return NextResponse.json(response);
}
