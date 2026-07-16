"use client";

import { useState, useEffect, useTransition } from "react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ViolationChart } from "@/components/dashboard/ViolationChart";
import { VehicleTypeChart } from "@/components/dashboard/VehicleTypeChart";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { RecentViolations } from "@/components/dashboard/RecentViolations";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import PipelineStatus from "@/components/dashboard/PipelineStatus";
import TrafficSimulation3D from "@/components/TrafficSimulation3D";
import { useRealtimeViolations } from "@/hooks/useRealtime";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Car, DollarSign, Navigation, Users, ChevronRight, Activity, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

// Data awal Tren
const initialHourlyData = [
  { hour: "00:00", ILLEGAL_PARKING: 12, BUSWAY_VIOLATION: 2, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 1, WRONG_LANE: 3, total: 18 },
  { hour: "04:00", ILLEGAL_PARKING: 8, BUSWAY_VIOLATION: 1, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 0, WRONG_LANE: 2, total: 11 },
  { hour: "08:00", ILLEGAL_PARKING: 45, BUSWAY_VIOLATION: 15, BICYCLE_LANE_VIOLATION: 8, BUS_STOP_VIOLATION: 12, WRONG_LANE: 22, total: 102 },
  { hour: "12:00", ILLEGAL_PARKING: 52, BUSWAY_VIOLATION: 8, BICYCLE_LANE_VIOLATION: 4, BUS_STOP_VIOLATION: 18, WRONG_LANE: 16, total: 98 },
  { hour: "16:00", ILLEGAL_PARKING: 60, BUSWAY_VIOLATION: 20, BICYCLE_LANE_VIOLATION: 10, BUS_STOP_VIOLATION: 25, WRONG_LANE: 30, total: 145 },
  // Data jam sekarang akan diupdate di array terakhir ini
  { hour: "Sekarang", ILLEGAL_PARKING: 0, BUSWAY_VIOLATION: 0, BICYCLE_LANE_VIOLATION: 0, BUS_STOP_VIOLATION: 0, WRONG_LANE: 0, total: 0 },
];

const initialVehicleData = [
  { name: "CAR", value: 0, color: "#3B82F6" },
  { name: "MOTORCYCLE", value: 0, color: "#10B981" },
  { name: "BUS", value: 0, color: "#F59E0B" },
  { name: "TRUCK", value: 0, color: "#EF4444" },
];

export default function Dashboard() {
  const [totalViolationsToday, setTotalViolationsToday] = useState(0);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, startTransition] = useTransition();
  
  // State Dinamis
  const [vehicleData, setVehicleData] = useState(initialVehicleData);
  const [hourlyData, setHourlyData] = useState(initialHourlyData);
  const [avgConfidence, setAvgConfidence] = useState(98.5); 

  // State Kamera & Traffic live
  const [activeCams, setActiveCams] = useState<{ active: number; total: number } | null>(null);
  const [cityTraffic, setCityTraffic] = useState<{
    level: string; score: number; color: string;
    cameras: { name: string; congestion: number; count: number }[];
    _source: string;
  } | null>(null);

  // State AI Insights
  const [aiInsights, setAiInsights] = useState<{
    pad_today_rp: number;
    _source: string;
    ai_insights: { icon: string; level: string; title: string; body: string }[];
    violations: { today: number };
  } | null>(null);
  
  // State Alert
  const [hasCriticalAlert, setHasCriticalAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Fungsi Play Audio Anti-Error Browser
  const playBeep = () => {
    try {
      const audio = new Audio('https://www.soundjay.com/buttons/sounds/beep-07a.mp3'); 
      const playPromise = audio.play();
      
      // Tangkap error jika browser memblokir suara karena belum ada interaksi user
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("⚠️ Suara diblokir browser. Silakan klik layar website 1x agar web diizinkan membunyikan suara.");
        });
      }
    } catch (error) {
      console.error("Audio play failed", error);
    }
  };

  // Fetch Data Awal dari Database
  useEffect(() => {
    const fetchDashboardData = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Ambil 10 data terbaru
      const { data: recent } = await supabase
        .from('violations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recent) {
        const formattedRecent = recent.map((v: any) => ({
          id: v.id,
          cameraId: v.camera_id,
          type: v.type,
          licensePlate: v.license_plate,
          vehicleType: v.vehicle_type,
          confidence: v.confidence,
          location: v.location || "Lokasi Tidak Diketahui",
          status: v.status || "PENDING",
          timestamp: new Date(v.created_at),
        }));
        setRecentViolations(formattedRecent);
      }

      // Hitung total hari ini
      const { count } = await supabase
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());
      
      if (count !== null) setTotalViolationsToday(count);

      // Hitung Distribusi Kendaraan hari ini
      const { data: todayData } = await supabase
        .from('violations')
        .select('vehicle_type')
        .gte('created_at', today.toISOString());

      if (todayData) {
        const counts: Record<string, number> = { CAR: 0, MOTORCYCLE: 0, BUS: 0, TRUCK: 0 };
        todayData.forEach((v: any) => {
          if (counts[v.vehicle_type] !== undefined) counts[v.vehicle_type]++;
        });
        setVehicleData(prev => prev.map(item => ({ ...item, value: counts[item.name] || 0 })));
      }
    };

    fetchDashboardData();
  }, []);

  // ── Fetch kamera aktif dan traffic metrics live ───────────────────────────
  useEffect(() => {
    async function fetchLiveMetrics() {
      // Kamera aktif dari DB
      const { data: camsAll } = await supabase.from("cameras").select("status");
      if (camsAll) {
        setActiveCams({
          active: camsAll.filter((c) => c.status === "ACTIVE").length,
          total: camsAll.length,
        });
      }

      // Traffic metrics ringkasan kota
      try {
        const res = await fetch("/api/traffic-metrics?hours=1");
        const json = await res.json();
        if (json.cameras && json.cameras.length > 0) {
          const summary = json.city_summary;
          const cams = json.cameras as { name: string; avg_congestion: number; latest_count: number }[];
          setCityTraffic({
            level: summary.congestion_level,
            score: Math.round(summary.avg_congestion * 100),
            color: summary.avg_congestion >= 0.8 ? "#EF4444"
              : summary.avg_congestion >= 0.55 ? "#F97316"
              : summary.avg_congestion >= 0.3  ? "#F59E0B"
              : "#10B981",
            cameras: cams.map((c) => ({ name: c.name, congestion: c.avg_congestion, count: c.latest_count })),
            _source: json._source ?? "unknown",
          });
        }
      } catch {
        // silently ignore — fallback ke null (tidak tampilkan widget)
      }
    }
    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch AI Analytics Insight ───────────────────────────────────────────
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics");
        const json = await res.json();
        if (json.ai_insights) setAiInsights(json);
      } catch { /* silent */ }
    }
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 300000); // refresh tiap 5 menit
    return () => clearInterval(interval);
  }, []);

  // MENDENGARKAN DATA REALTIME DARI AI PYTHON
  useRealtimeViolations((newRecord: any) => {
    // 1. Mainkan suara peringatan
    playBeep();
    
    // 2. Munculkan Notifikasi Merah
    setHasCriticalAlert(true);
    setAlertMessage(`🚨 PELANGGARAN BARU: ${newRecord.vehicle_type} (${newRecord.license_plate}) melakukan ${newRecord.type.replace(/_/g, ' ')} di ${newRecord.location}`);
    
    // Matikan notifikasi setelah 8 detik
    setTimeout(() => {
      setHasCriticalAlert(false);
    }, 8000);

    // 3. Tambah angka total pelanggaran
    setTotalViolationsToday((prev) => prev + 1);

    // 4. Update Akurasi ANPR Dinamis (Rata-rata confidence)
    if (newRecord.confidence) {
      setAvgConfidence((prev) => {
        const newConf = newRecord.confidence * 100;
        return Number(((prev * 9 + newConf) / 10).toFixed(1));
      });
    }

    // 5. Update Tren Pelanggaran (Chart Area - Diperbaiki agar sesuai aturan React)
    setHourlyData((prev) => {
      const newData = [...prev];
      const lastIndex = newData.length - 1;
      const typeKey = newRecord.type as keyof typeof newData[0];
      
      if (newData[lastIndex][typeKey] !== undefined) {
        // Buat objek baru agar React mendeteksi perubahan state
        newData[lastIndex] = {
          ...newData[lastIndex],
          [typeKey]: (newData[lastIndex][typeKey] as number) + 1,
          total: newData[lastIndex].total + 1
        };
      }
      return newData;
    });

    // 6. Masukkan data ke list Terbaru
    const newDet = {
      id: newRecord.id || Math.random().toString(),
      cameraId: newRecord.camera_id,
      type: newRecord.type,
      licensePlate: newRecord.license_plate,
      vehicleType: newRecord.vehicle_type,
      confidence: newRecord.confidence,
      location: newRecord.location || "Lokasi Tidak Diketahui",
      status: "PENDING",
      timestamp: new Date(newRecord.created_at || Date.now()),
    };
    setRecentViolations((prev) => [newDet, ...prev].slice(0, 10));

    // 7. Update Pie Chart Kendaraan
    setVehicleData((prevData) => {
      return prevData.map((item) => {
        if (item.name === newRecord.vehicle_type) {
          return { ...item, value: item.value + 1 };
        }
        return item;
      });
    });
  });

  return (
    <div className="space-y-6">
      {hasCriticalAlert && (
        <AlertBanner message={alertMessage} type="critical" />
      )}

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Pelanggaran Hari Ini"
          value={totalViolationsToday}
          trend={totalViolationsToday > 0 ? 2.5 : 0} 
          colorTheme="red"
          delay={0.1}
        />
        <StatsCard
          title="Kamera Aktif"
          value={activeCams ? `${activeCams.active} / ${activeCams.total}` : "Memuat..."}
          subtitle={activeCams ? `${activeCams.active} CCTV online` : "Mengambil data..."}
          colorTheme="blue"
          delay={0.2}
        />
        <StatsCard
          title="Akurasi AI / ANPR"
          value={avgConfidence}
          trend={0.1}
          colorTheme="green"
          delay={0.3}
        />
        <StatsCard
          title="Waktu Respons Rata-rata"
          value={aiInsights ? `Rp ${(aiInsights.pad_today_rp / 1_000_000).toFixed(1)} Jt` : "1.2"}
          subtitle={aiInsights ? "Est. PAD hari ini" : "detik"}
          trend={aiInsights ? undefined : -15.4}
          colorTheme="amber"
          delay={0.4}
        />
      </div>

      <PipelineStatus />

      {/* ── City Traffic Widget ─────────────────────────────────────────── */}
      {cityTraffic && (
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-accent-cyan" />
              <div>
                <h2 className="font-heading text-base font-bold text-white">Status Lalu Lintas Kota — Real-time</h2>
                <p className="text-xs text-text-muted">Data dari {cityTraffic.cameras.length} kamera CCTV aktif</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold border"
                style={{ color: cityTraffic.color, borderColor: `${cityTraffic.color}40`, backgroundColor: `${cityTraffic.color}15` }}
              >
                {cityTraffic.level} · Skor {cityTraffic.score}/100
              </span>
              <span className={cn(
                "rounded-full px-2 py-1 text-[10px] font-bold border",
                cityTraffic._source.includes("VISTA_TrafficMetrics")
                  ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
                  : "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
              )}>
                {cityTraffic._source.includes("VISTA_TrafficMetrics") ? "🟢 Live DB" : "🟡 Estimasi"}
              </span>
              <Link href="/traffic-forecast" className="text-xs text-accent-cyan hover:underline flex items-center gap-1">
                Detail Forecast <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
          {/* Mini bar chart per kamera */}
          <div className="flex items-end gap-2 h-16 overflow-x-auto pb-1">
            {cityTraffic.cameras.map((cam) => {
              const pct = Math.round(cam.congestion * 100);
              const barColor = pct >= 80 ? "#EF4444" : pct >= 55 ? "#F97316" : pct >= 30 ? "#F59E0B" : "#10B981";
              return (
                <div key={cam.name} className="flex flex-col items-center gap-1 min-w-[48px] flex-1">
                  <span className="text-[9px] text-text-muted font-mono">{pct}%</span>
                  <div className="w-full rounded-t-sm flex-1 min-h-[4px]" style={{ height: `${Math.max(4, pct * 0.56)}px`, backgroundColor: barColor, opacity: 0.85 }} />
                  <span className="text-[9px] text-text-muted truncate w-full text-center" title={cam.name}>
                    {cam.name.replace("CCTV ", "").split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI City Insight Panel ─────────────────────────────────────────── */}
      {aiInsights && aiInsights.ai_insights.length > 0 && (
        <div className="rounded-xl border border-border bg-bg-secondary p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BrainCircuit className="h-5 w-5 text-accent-blue" />
              <div>
                <h2 className="font-heading text-base font-bold text-white">AI City Intelligence</h2>
                <p className="text-xs text-text-muted">Insight otomatis berbasis analitik lintas sistem</p>
              </div>
            </div>
            <span className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold border",
              aiInsights._source === "DB_Live"
                ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
                : "bg-accent-amber/10 border-accent-amber/30 text-accent-amber"
            )}>
              {aiInsights._source === "DB_Live" ? "🟢 Live Analysis" : "🟡 Partial Data"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {aiInsights.ai_insights.map((insight, i) => {
              const borderColor = insight.level === "critical" ? "border-accent-red/30 bg-accent-red/5"
                : insight.level === "warning" ? "border-accent-amber/30 bg-accent-amber/5"
                : "border-border bg-bg-tertiary";
              const titleColor = insight.level === "critical" ? "text-accent-red"
                : insight.level === "warning" ? "text-accent-amber"
                : "text-white";
              return (
                <div key={i} className={cn("rounded-xl border p-4 flex flex-col gap-2", borderColor)}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{insight.icon}</span>
                    <p className={cn("font-semibold text-sm leading-tight", titleColor)}>{insight.title}</p>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{insight.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-bg-secondary p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-white">Tren Pelanggaran</h2>
              <p className="text-xs text-text-muted">Distribusi data Real-time</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ViolationChart data={hourlyData} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-secondary p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold text-white">Distribusi Kendaraan</h2>
            <p className="text-xs text-text-muted">Berdasarkan deteksi AI hari ini</p>
          </div>
          <div className="h-[300px] w-full">
            <VehicleTypeChart data={vehicleData} />
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="font-heading text-base font-bold text-white mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-amber animate-pulse" />
          Fitur Implementasi Skala Jakarta
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/ganjil-genap" className="rounded-xl border border-accent-amber/20 bg-accent-amber/10 p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity">
            <Car className="h-5 w-5 text-accent-amber" />
            <div><p className="text-sm font-semibold text-accent-amber">Ganjil Genap</p><p className="text-xs text-text-muted">Deteksi Otomatis</p></div>
            <ChevronRight className="h-4 w-4 text-accent-amber self-end" />
          </Link>
          <Link href="/erp" className="rounded-xl border border-accent-green/20 bg-accent-green/10 p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity">
            <DollarSign className="h-5 w-5 text-accent-green" />
            <div><p className="text-sm font-semibold text-accent-green">ERP / Tarif Jalan</p><p className="text-xs text-text-muted">Potensi PAD Jakarta</p></div>
            <ChevronRight className="h-4 w-4 text-accent-green self-end" />
          </Link>
          <Link href="/traffic-forecast" className="rounded-xl border border-accent-cyan/20 bg-accent-cyan/10 p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity">
            <Navigation className="h-5 w-5 text-accent-cyan" />
            <div><p className="text-sm font-semibold text-accent-cyan">Prediksi Kemacetan</p><p className="text-xs text-text-muted">AI Forecasting</p></div>
            <ChevronRight className="h-4 w-4 text-accent-cyan self-end" />
          </Link>
          <Link href="/citizen-report" className="rounded-xl border border-accent-blue/20 bg-accent-blue/10 p-4 flex flex-col gap-2 hover:opacity-80 transition-opacity">
            <Users className="h-5 w-5 text-accent-blue" />
            <div><p className="text-sm font-semibold text-accent-blue">Laporan Warga</p><p className="text-xs text-text-muted">JAKI Integration</p></div>
            <ChevronRight className="h-4 w-4 text-accent-blue self-end" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 h-[500px]">
          <LiveFeed />
        </div>
        <div className="lg:col-span-3 h-[500px]">
          <RecentViolations violations={recentViolations as any} />
        </div>
      </div>

      {/* Digital Twin */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-base font-bold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse" />
            Digital Twin — Simulasi Lalu Lintas Jakarta
          </h2>
          <Link href="/peta" className="text-xs text-accent-cyan hover:underline flex items-center gap-1">
            Buka 3D Full View <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="h-[420px]">
          <TrafficSimulation3D />
        </div>
      </div>
    </div>
  );
}