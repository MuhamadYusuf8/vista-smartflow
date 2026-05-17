'use client'
import { useEffect, useState } from 'react'

interface PipelineData {
  total: number; pending: number; verified: number; exported: number; alertsSent: number
}

export default function PipelineStatus() {
  const [data, setData] = useState<PipelineData | null>(null)

  useEffect(() => {
    const load = () => fetch('/api/automation/status').then(r => r.json()).then(setData).catch(() => {})
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (!data) return null

  const steps = [
    { label: 'Total Deteksi', value: data.total, color: '#3B82F6' },
    { label: 'Menunggu', value: data.pending, color: '#F59E0B' },
    { label: 'Terverifikasi', value: data.verified, color: '#10B981' },
    { label: 'Alert Terkirim', value: data.alertsSent, color: '#8B5CF6' },
    { label: 'E-TLE Ekspor', value: data.exported, color: '#06B6D4' }
  ]

  return (
    <div className="bg-[#0F1628] border border-[#1E2D4D] rounded-xl p-4">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Pipeline Otomasi Hari Ini</p>
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2 flex-1">
            <div className="text-center flex-1">
              <div className="text-lg font-semibold" style={{ color: step.color }}>{step.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{step.label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="text-slate-600 text-lg flex-shrink-0">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
