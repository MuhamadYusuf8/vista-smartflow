import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: cameras, error } = await supabase
    .from('cameras')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get violation counts per camera for today
  const { data: counts } = await supabase
    .from('violations')
    .select('camera_id')
    .gte('timestamp', todayStart.toISOString())

  const countMap: Record<string, number> = {}
  ;(counts ?? []).forEach(v => {
    countMap[v.camera_id] = (countMap[v.camera_id] ?? 0) + 1
  })

  const result = (cameras ?? []).map(cam => ({
    ...cam,
    violations_today: countMap[cam.id] ?? 0,
    uptime: cam.status === 'ACTIVE' ? 98 + Math.random() * 2 : cam.status === 'MAINTENANCE' ? 0 : 45
  }))

  return NextResponse.json({ cameras: result })
}