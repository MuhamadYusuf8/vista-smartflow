'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Detection {
  id: string
  plate: string
  type: string
  confidence: number
  x: number; y: number; w: number; h: number
}

const VIOLATION_LABELS: Record<string, string> = {
  ILLEGAL_PARKING: 'Parkir Liar',
  BUSWAY_VIOLATION: 'Jalur Busway',
  BICYCLE_LANE_VIOLATION: 'Jalur Sepeda',
  BUS_STOP_VIOLATION: 'Halte Bus'
}
const VIOLATION_COLORS: Record<string, string> = {
  ILLEGAL_PARKING: '#EF4444',
  BUSWAY_VIOLATION: '#F59E0B',
  BICYCLE_LANE_VIOLATION: '#8B5CF6',
  BUS_STOP_VIOLATION: '#3B82F6'
}
const PLATES = ['B','F','D','Z','E']
function randomPlate() {
  return `${PLATES[Math.floor(Math.random()*PLATES.length)]} ${Math.floor(Math.random()*9000+1000)} ${String.fromCharCode(65+Math.floor(Math.random()*26))}${String.fromCharCode(65+Math.floor(Math.random()*26))}${String.fromCharCode(65+Math.floor(Math.random()*26))}`
}
function randomViolationType() {
  return Object.keys(VIOLATION_LABELS)[Math.floor(Math.random()*4)]
}

interface Props {
  cameraId?: string
  streamUrl?: string | null
  cameraName?: string
  location?: string
  onViolationDetected?: (data: { plate: string; type: string; confidence: number; screenshotUrl?: string }) => void
}

export default function PrimaryCCTV({
  cameraId = 'cctv-bhi-01',
  streamUrl,
  cameraName = 'CCTV-BHI-01',
  location = 'Bundaran HI, Jl. MH Thamrin',
  onViolationDetected
}: Props) {
  const [ready, setReady] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [time, setTime] = useState('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error(err))
    } else {
      document.exitFullscreen()
    }
  }

  // Track mount/unmount and check video ready state
  useEffect(() => {
    mountedRef.current = true
    if (videoRef.current && videoRef.current.readyState >= 3) {
      setReady(true)
    }
    return () => { mountedRef.current = false }
  }, [])

  // Live clock
  useEffect(() => {
    const tick = () => {
      if (mountedRef.current) {
        setTime(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  // Simulated AI detection loop (DIUBAH HANYA UNTUK VISUAL)
  const runDetection = useCallback(async () => {
    if (!mountedRef.current) return
    if (Math.random() < 0.35) {
      const type = randomViolationType()
      const confidence = parseFloat((0.80 + Math.random() * 0.19).toFixed(3))
      const plate = randomPlate()
      const det: Detection = {
        id: Date.now().toString(),
        plate, type, confidence,
        x: 10 + Math.random() * 40,
        y: 20 + Math.random() * 35,
        w: 20 + Math.random() * 20,
        h: 12 + Math.random() * 10
      }
      if (mountedRef.current) setDetections([det])

      // Auto-post ke API telah DIMATIKAN agar tidak bentrok dengan Python
      /*
      if (confidence >= 0.85) {
        onViolationDetected?.({ plate, type, confidence })
        await fetch('/api/violations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            camera_id: cameraId,
            type,
            license_plate: plate,
            vehicle_type: 'CAR',
            confidence,
            location,
            lat: -6.1944 + (Math.random()-0.5)*0.002,
            lng: 106.8229 + (Math.random()-0.5)*0.002
          })
        }).catch(console.error)
      }
      */

      // Clear detection after 5 seconds
      setTimeout(() => { if (mountedRef.current) setDetections([]) }, 5000)
    }
  }, [cameraId, location, onViolationDetected])

  useEffect(() => {
    if (!ready) return
    intervalRef.current = setInterval(runDetection, 6000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [ready, runDetection])

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        background: '#000', 
        borderRadius: isFullscreen ? 0 : 12, 
        overflow: 'hidden', 
        aspectRatio: isFullscreen ? 'auto' : '16/9', 
        width: '100%',
        height: isFullscreen ? '100vh' : 'auto'
      }}
    >
      
      {/* NATIVE HTML5 VIDEO UNTUK LOKAL MP4 */}
      <video
        ref={videoRef}
        src="/traffic-hd.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{ 
          position: 'absolute',
          inset: 0,
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          objectPosition: 'center bottom'
        }}
        onCanPlay={() => setReady(true)}
        onLoadedData={() => setReady(true)}
      />

      {/* AI Bounding boxes */}
      {detections.map(det => (
        <div key={det.id} style={{
          position: 'absolute',
          left: `${det.x}%`, top: `${det.y}%`,
          width: `${det.w}%`, height: `${det.h}%`,
          border: `2px solid ${VIOLATION_COLORS[det.type] ?? '#EF4444'}`,
          borderRadius: 4,
          boxShadow: `0 0 16px ${VIOLATION_COLORS[det.type] ?? '#EF4444'}66`,
          pointerEvents: 'none',
          transition: 'all 0.4s'
        }}>
          <div style={{
            position: 'absolute', top: -26, left: 0,
            background: VIOLATION_COLORS[det.type] ?? '#EF4444',
            color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: '4px 4px 0 0',
            whiteSpace: 'nowrap', fontFamily: 'monospace'
          }}>
            {det.plate} · {VIOLATION_LABELS[det.type]} · {Math.round(det.confidence * 100)}%
          </div>
        </div>
      ))}

      {/* Top badges */}
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
        <span style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
          REC LIVE
        </span>
        <span style={{ background: 'rgba(0,0,0,0.65)', color: '#22d3ee', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4 }}>
          AI ACTIVE
        </span>
      </div>

      {/* Fullscreen Button */}
      <button 
        onClick={toggleFullscreen}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(0,0,0,0.65)', color: '#fff', 
          border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: 6,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 600, transition: 'all 0.2s', zIndex: 50
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.85)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.65)'}
      >
        {isFullscreen ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            EXIT FULL VIEW
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            FULL VIEW
          </>
        )}
      </button>

      {/* Bottom overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '24px 14px 10px'
      }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{cameraName} · {location}</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{time} WIB · TMC Polda Metro Jaya</div>
      </div>

      {/* Loading overlay */}
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0A0E1A',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          <div style={{ width: 36, height: 36, border: '3px solid #1E2D4D', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94A3B8', fontSize: 13 }}>Memuat video lokal...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}