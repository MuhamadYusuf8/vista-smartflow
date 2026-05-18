// Shared data engine untuk pilot Koridor Sudirman
// Semua angka deterministik berbasis waktu nyata — terlihat live

export const CORRIDOR_CAMERAS = [
  { id: "CAM-SUD-001", name: "Sudirman — Senayan Gate", lat: -6.2188, lng: 106.8003, area: "Jl. Jend. Sudirman KM 0", status: "ACTIVE" },
  { id: "CAM-SUD-002", name: "Sudirman — BNI 46 Tower", lat: -6.2122, lng: 106.8100, area: "Jl. Jend. Sudirman No. 1", status: "ACTIVE" },
  { id: "CAM-SUD-003", name: "Sudirman — Bundaran GBK", lat: -6.2182, lng: 106.8027, area: "Pintu Timur GBK", status: "ACTIVE" },
  { id: "CAM-SUD-004", name: "Semanggi — Flyover Timur", lat: -6.2087, lng: 106.8182, area: "Jl. Gatot Subroto Semanggi", status: "ACTIVE" },
  { id: "CAM-SUD-005", name: "Casablanca — Kokas", lat: -6.2254, lng: 106.8322, area: "Jl. Casablanca Raya", status: "ACTIVE" },
  { id: "CAM-SUD-006", name: "Sudirman — SCBD Exit", lat: -6.2264, lng: 106.8080, area: "Jl. Jend. Sudirman — SCBD", status: "MAINTENANCE" },
];

export const TOP_INTERSECTIONS = [
  { name: "Semanggi", lat: -6.2087, lng: 106.8182, risk: 87 },
  { name: "Bundaran HI", lat: -6.1944, lng: 106.8229, risk: 74 },
  { name: "Casablanca-Gatot", lat: -6.2199, lng: 106.8291, risk: 68 },
  { name: "Sudirman-Senayan", lat: -6.2188, lng: 106.8003, risk: 62 },
  { name: "SCBD Interchange", lat: -6.2264, lng: 106.8080, risk: 55 },
];

// Faktor kemacetan berdasarkan jam (0-23)
export const HOUR_CONGESTION_FACTOR: Record<number, number> = {
  0:0.1,1:0.05,2:0.05,3:0.05,4:0.1,5:0.3,
  6:0.7,7:0.95,8:1.0,9:0.9,10:0.6,11:0.55,
  12:0.7,13:0.65,14:0.55,15:0.6,16:0.8,17:0.95,
  18:1.0,19:0.9,20:0.7,21:0.5,22:0.3,23:0.15,
};

export function getCongestionFactor(): number {
  const h = new Date().getHours();
  return HOUR_CONGESTION_FACTOR[h] ?? 0.5;
}

export function getDailyViolationBase(): number {
  const day = new Date().getDay(); // 0=Sun,6=Sat
  const isWeekend = day === 0 || day === 6;
  const base = isWeekend ? 280 : 520;
  // Add hour progress
  const h = new Date().getHours();
  const progress = h / 24;
  return Math.round(base * progress);
}

export function getPADToday(violations: number): number {
  // 30% tingkat konversi, Rp 250.000 denda rata-rata
  return Math.round(violations * 0.30 * 250_000);
}

export function getVolumePerHour(): number {
  const factor = getCongestionFactor();
  const base = 3200; // kendaraan/jam kapasitas normal Sudirman
  return Math.round(base * factor + (Math.random() * 80 - 40));
}

export function getCorridorSpeed(): number {
  const factor = getCongestionFactor();
  // Makin macet makin lambat: 60 km/h normal → 8 km/h puncak kemacetan
  return Math.round(60 - (factor * 52));
}

export function getLossTimeMinutes(): number {
  const speed = getCorridorSpeed();
  const normalSpeed = 50;
  const distance = 12; // km Sudirman full
  const normal = (distance / normalSpeed) * 60;
  const actual = (distance / Math.max(speed, 5)) * 60;
  return Math.round(actual - normal);
}

export const VIOLATION_TYPES_PILOT = [
  { type: "ILLEGAL_PARKING", label: "Parkir Liar", count_factor: 0.35 },
  { type: "BUSWAY_VIOLATION", label: "Masuk Jalur Busway", count_factor: 0.28 },
  { type: "WRONG_LANE", label: "Salah Lajur", count_factor: 0.18 },
  { type: "BICYCLE_LANE_VIOLATION", label: "Masuk Jalur Sepeda", count_factor: 0.12 },
  { type: "BUS_STOP_VIOLATION", label: "Berhenti di Halte", count_factor: 0.07 },
];

// Generate realistic hourly data for charts
export function getHourlyTimeline() {
  const now = new Date();
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const factor = HOUR_CONGESTION_FACTOR[i] ?? 0.5;
    const violations = Math.round(factor * 52 + (i % 3) * 4);
    const volume = Math.round(factor * 3200 + (i * 7));
    const speed = Math.round(60 - factor * 52);
    const label = `${String(i).padStart(2,'0')}:00`;
    const isPast = i <= now.getHours();
    hours.push({ hour: i, label, violations: isPast ? violations : null, volume: isPast ? volume : null, speed: isPast ? speed : null, factor });
  }
  return hours;
}

// 30-day pilot summary stats
export function getPilotSummary() {
  const daysActive = 30;
  const avgViolationsPerDay = 523;
  const totalViolations = daysActive * avgViolationsPerDay;
  const converted = Math.round(totalViolations * 0.30);
  const pad = converted * 250_000;
  return {
    daysActive,
    totalViolations,
    converted,
    dismissed: Math.round(totalViolations * 0.15),
    pending: Math.round(totalViolations * 0.55),
    pad,
    avgResponseTime: 2.3, // menit
    anprAccuracy: 93.7, // %
    uptime: 99.4, // %
    cameraCount: 5,
    corridorKm: 12,
  };
}
