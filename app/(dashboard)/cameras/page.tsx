'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Camera, supabase } from '@/lib/supabase' // Menambahkan import supabase

const PrimaryCCTV = dynamic(() => import('@/components/cameras/PrimaryCCTV'), {
  ssr: false,
  loading: () => (
    <div style={{ aspectRatio: '16/9', background: '#0A0E1A', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#475569', fontSize: 13 }}>Memuat player...</span>
    </div>
  )
})

export default function CamerasPage() {
  const [cameras, setCameras] = useState<(Camera & { violations_today: number; uptime: number })[]>([])
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [recentDetections, setRecentDetections] = useState<Array<{ plate: string; type: string; confidence: number; time: string }>>([])
  const [loading, setLoading] = useState(true)

  // 1. Fetch data awal saat halaman dimuat
  useEffect(() => {
    fetch('/api/cameras')
      .then(r => r.json())
      .then(d => {
        setCameras(d.cameras ?? [])
        const primary = d.cameras?.find((c: Camera) => c.status === 'ACTIVE' && c.stream_url)
        if (primary) setPrimaryId(primary.id)
        setLoading(false)
      })
  }, [])

// 1. Fetch data awal saat halaman dimuat & Setup Realtime
  useEffect(() => {
    // A. FUNGSI UNTUK MENARIK DATA LAMA DARI DATABASE (HISTORY)
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('violations')
        .select('*')
        .order('created_at', { ascending: false }) // Urutkan dari yang paling baru
        .limit(10); // Ambil 10 data terakhir agar UI tidak kepenuhan

      if (data && !error) {
        // Format datanya agar sesuai dengan bentuk state recentDetections kamu
        const historyData = data.map((v: any) => ({
          plate: v.license_plate,
          type: v.type,
          confidence: v.confidence,
          // Ubah format waktu database ISO ke jam lokal (HH:MM:SS)
          time: new Date(v.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }));
        
        // Masukkan data lama ini ke state
        setRecentDetections(historyData);
      }
    };

    // Panggil fungsinya saat halaman pertama kali dibuka
    fetchHistory();

    // B. LOGIKA REALTIME: Mendengarkan data baru yang masuk (Sihir yang kemarin)
    const channel = supabase
      .channel('realtime-violations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'violations',
        },
        (payload) => {
          const newViolation = payload.new;
          const newDet = {
            plate: newViolation.license_plate,
            type: newViolation.type,
            confidence: newViolation.confidence,
            time: new Date(newViolation.created_at || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          
          // Gabungkan data baru ke data yang sudah ada, batasi maksimal 10
          setRecentDetections(prev => [newDet, ...prev].slice(0, 10));

          // Perbarui angka jumlah pelanggaran di kartu kamera
          setCameras(prev => prev.map(cam => 
            cam.id === newViolation.camera_id 
              ? { ...cam, violations_today: cam.violations_today + 1 } 
              : cam
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const primaryCamera = cameras.find(c => c.id === primaryId) ?? cameras.find(c => c.status === 'ACTIVE')
  const secondaryCameras = cameras.filter(c => c.id !== primaryCamera?.id)

  // handleDetection tetap ada jika sewaktu-waktu ingin simulasi lagi
  const handleDetection = (data: { plate: string; type: string; confidence: number }) => {
    // Fungsi ini sekarang bersifat opsional karena Realtime sudah menangani deteksi asli
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-900 text-green-300 border-green-700',
    INACTIVE: 'bg-red-900 text-red-300 border-red-700',
    MAINTENANCE: 'bg-amber-900 text-amber-300 border-amber-700'
  }
  const statusLabels: Record<string, string> = { ACTIVE: 'Aktif', INACTIVE: 'Tidak Aktif', MAINTENANCE: 'Maintenance' }
  const violationLabels: Record<string, string> = {
    ILLEGAL_PARKING: 'Parkir Liar', BUSWAY_VIOLATION: 'Jalur Busway',
    BICYCLE_LANE_VIOLATION: 'Jalur Sepeda', BUS_STOP_VIOLATION: 'Halte Bus'
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Memuat data kamera...</div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">CCTV Monitor</h1>
          <p className="text-slate-400 text-sm mt-1">Pantau kamera utama secara real-time</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded transition-colors">+ Tambah Kamera</button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Kamera', value: cameras.length, color: 'text-white' },
          { label: 'Aktif Merekam', value: cameras.filter(c => c.status === 'ACTIVE').length, color: 'text-green-400' },
          { label: 'Tidak Aktif', value: cameras.filter(c => c.status === 'INACTIVE').length, color: 'text-red-400' },
          { label: 'Maintenance', value: cameras.filter(c => c.status === 'MAINTENANCE').length, color: 'text-amber-400' }
        ].map(s => (
          <div key={s.label} className="bg-[#0F1628] border border-[#1E2D4D] rounded-xl p-4">
            <p className="text-slate-400 text-sm">{s.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Primary camera section */}
      {primaryCamera && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-medium">Kamera Utama</h2>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                LIVE • AI Detection Aktif
              </span>
            </div>
            <PrimaryCCTV
              cameraId={primaryCamera.id}
              streamUrl={primaryCamera.stream_url ?? undefined}
              cameraName={primaryCamera.name}
              location={primaryCamera.location}
              onViolationDetected={handleDetection}
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-white font-medium">Deteksi Terbaru</h2>
            <div className="bg-[#0F1628] border border-[#1E2D4D] rounded-xl overflow-hidden">
              {recentDetections.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">Menunggu deteksi AI...</div>
              ) : (
                <div className="divide-y divide-[#1E2D4D]">
                  {recentDetections.map((d, i) => (
                    <div key={i} className="p-3 space-y-1 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-white bg-[#151D35] px-2 py-0.5 rounded border border-[#1E2D4D]">{d.plate}</span>
                        <span className="text-slate-500 text-xs">{d.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">{violationLabels[d.type] ?? d.type}</span>
                        <span className="text-xs text-slate-500">• {Math.round(d.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0F1628] border border-[#1E2D4D] rounded-xl p-4 space-y-2">
              <p className="text-slate-400 text-xs uppercase tracking-wider">Info Kamera Utama</p>
              <p className="text-white text-sm font-medium">{primaryCamera.name}</p>
              <p className="text-slate-400 text-xs">{primaryCamera.location}</p>
              <div className="flex gap-3 pt-1">
                <div><p className="text-slate-500 text-xs">Uptime</p><p className="text-green-400 text-sm font-medium">99.1%</p></div>
                <div><p className="text-slate-500 text-xs">Pelanggaran Hari Ini</p><p className="text-red-400 text-sm font-medium">{primaryCamera.violations_today}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary cameras grid */}
      <div>
        <h2 className="text-white font-medium mb-3">Kamera Pendukung</h2>
        <div className="grid grid-cols-4 gap-4">
          {secondaryCameras.map(cam => (
            <div key={cam.id} className="bg-[#0F1628] border border-[#1E2D4D] rounded-xl overflow-hidden">
              <div className="aspect-video bg-[#0A0E1A] flex items-center justify-center relative">
                {cam.status === 'ACTIVE' ? (
                  <>
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-pulse" />REC
                    </div>
                    <div className="text-slate-600 text-xs text-center">
                      <div className="text-2xl mb-1">📹</div>
                      <div>Stream tersedia</div>
                    </div>
                  </>
                ) : cam.status === 'MAINTENANCE' ? (
                  <div className="text-center text-amber-600 text-xs">
                    <div className="text-2xl mb-1">🛠</div>
                    <div>Maintenance</div>
                  </div>
                ) : (
                  <div className="text-center text-slate-600 text-xs">
                    <div className="text-2xl mb-1">📡</div>
                    <div>Signal Lost</div>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-xs font-medium leading-tight">{cam.name}</p>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${statusColors[cam.status]}`}>
                    {statusLabels[cam.status]}
                  </span>
                </div>
                <p className="text-slate-500 text-xs leading-tight">{cam.location}</p>
                <div className="flex gap-3 text-xs">
                  <span className="text-slate-400">Uptime <span className="text-white">{cam.uptime.toFixed(1)}%</span></span>
                  <span className="text-slate-400">Hari ini <span className="text-red-400">{cam.violations_today}</span></span>
                </div>
                {cam.status === 'ACTIVE' && cam.id !== primaryCamera?.id && (
                  <button
                    onClick={() => setPrimaryId(cam.id)}
                    className="w-full text-xs text-blue-400 border border-blue-900 rounded py-1 hover:bg-blue-900/30 transition-colors"
                  >
                    Jadikan Utama
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}