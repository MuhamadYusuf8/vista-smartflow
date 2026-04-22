import { Suspense } from "react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ViolationChart } from "@/components/dashboard/ViolationChart";
import { VehicleTypeChart } from "@/components/dashboard/VehicleTypeChart";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { RecentViolations } from "@/components/dashboard/RecentViolations";
import { AlertBanner } from "@/components/dashboard/AlertBanner";

// These would normally be fetched from an API
const mockHourlyData = [
  { hour: "00:00", ILLEGAL_PARKING: 12, BUSWAY_VIOLATION: 2, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 1, WRONG_LANE: 3, total: 18 },
  { hour: "04:00", ILLEGAL_PARKING: 8, BUSWAY_VIOLATION: 1, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 0, WRONG_LANE: 2, total: 11 },
  { hour: "08:00", ILLEGAL_PARKING: 45, BUSWAY_VIOLATION: 15, BICYCLE_LANE_VIOLATION: 8, BUS_STOP_VIOLATION: 12, WRONG_LANE: 22, total: 102 },
  { hour: "12:00", ILLEGAL_PARKING: 52, BUSWAY_VIOLATION: 8, BICYCLE_LANE_VIOLATION: 4, BUS_STOP_VIOLATION: 18, WRONG_LANE: 16, total: 98 },
  { hour: "16:00", ILLEGAL_PARKING: 60, BUSWAY_VIOLATION: 20, BICYCLE_LANE_VIOLATION: 10, BUS_STOP_VIOLATION: 25, WRONG_LANE: 30, total: 145 },
  { hour: "20:00", ILLEGAL_PARKING: 35, BUSWAY_VIOLATION: 5, BICYCLE_LANE_VIOLATION: 2, BUS_STOP_VIOLATION: 8, WRONG_LANE: 10, total: 60 },
];

const mockVehicleData = [
  { name: "CAR", value: 125, color: "#3B82F6" },
  { name: "MOTORCYCLE", value: 87, color: "#10B981" },
  { name: "BUS", value: 42, color: "#F59E0B" },
  { name: "TRUCK", value: 24, color: "#EF4444" },
];

const mockRecentViolations = [
  {
    id: "1",
    cameraId: "cam1",
    type: "ILLEGAL_PARKING" as const,
    licensePlate: "B 1234 ABC",
    vehicleType: "CAR" as const,
    confidence: 0.96,
    duration: 345,
    evidenceUrl: "",
    location: "Jl. Jend. Sudirman KM 2",
    lat: -6.2, lng: 106.8,
    status: "PENDING" as const,
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    createdAt: new Date(), updatedAt: new Date()
  },
  {
    id: "2",
    cameraId: "cam2",
    type: "BUSWAY_VIOLATION" as const,
    licensePlate: "F 5678 DEF",
    vehicleType: "MOTORCYCLE" as const,
    confidence: 0.88,
    duration: null,
    evidenceUrl: "",
    location: "Jl. Gatot Subroto",
    lat: -6.2, lng: 106.8,
    status: "VERIFIED" as const,
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    createdAt: new Date(), updatedAt: new Date()
  },
  {
    id: "3",
    cameraId: "cam1",
    type: "ILLEGAL_PARKING" as const,
    licensePlate: "D 9012 GHI",
    vehicleType: "CAR" as const,
    confidence: 0.99,
    duration: 120,
    evidenceUrl: "",
    location: "Jl. MH Thamrin",
    lat: -6.2, lng: 106.8,
    status: "EXPORTED" as const,
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    createdAt: new Date(), updatedAt: new Date()
  }
];

export default function Dashboard() {
  const hasCriticalAlert = mockRecentViolations.some(
    (v) => v.status === "PENDING" && v.duration && v.duration > 300
  );

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {hasCriticalAlert && (
        <AlertBanner 
          message="KRITIS: 3 pelanggaran parkir liar belum diproses — durasi >5 menit terdeteksi" 
          type="critical" 
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Overview Dashboard
          </h1>
          <p className="text-sm text-text-muted">
            Sistem Pemantauan dan Penindakan Pelanggaran Lalu Lintas (VISTA)
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Pelanggaran Hari Ini"
          value={247}
          trend={12}
          colorTheme="red"
          delay={0.1}
        />
        <StatsCard
          title="Kamera Aktif"
          value="48 / 52"
          subtitle="3 maintenance"
          colorTheme="blue"
          delay={0.2}
        />
        <StatsCard
          title="Akurasi ANPR"
          value={96.8}
          trend={0.3}
          colorTheme="green"
          delay={0.3}
        />
        <StatsCard
          title="Waktu Respons Rata-rata"
          value="4.2"
          subtitle="menit"
          trend={-0.8}
          colorTheme="amber"
          delay={0.4}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-bg-secondary p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-white">Tren Pelanggaran</h2>
              <p className="text-xs text-text-muted">24 jam terakhir berdasarkan jenis</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ViolationChart data={mockHourlyData} />
          </div>
        </div>
        
        <div className="rounded-xl border border-border bg-bg-secondary p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold text-white">Distribusi Kendaraan</h2>
            <p className="text-xs text-text-muted">Berdasarkan deteksi AI hari ini</p>
          </div>
          <div className="h-[300px] w-full">
            <VehicleTypeChart data={mockVehicleData} />
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 h-[500px]">
          <LiveFeed />
        </div>
        <div className="lg:col-span-3 h-[500px]">
          <RecentViolations violations={mockRecentViolations as any} />
        </div>
      </div>
    </div>
  );
}
