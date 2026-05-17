import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)
  const last24h = new Date(Date.now() - 86400000)

  const [todayRes, yesterdayRes, cameraRes, hourlyRes, vehicleRes] = await Promise.all([
    supabase.from('violations').select('id', { count: 'exact' }).gte('timestamp', todayStart.toISOString()),
    supabase.from('violations').select('id', { count: 'exact' }).gte('timestamp', yesterday.toISOString()).lt('timestamp', todayStart.toISOString()),
    supabase.from('cameras').select('status'),
    supabase.from('violations').select('timestamp, type').gte('timestamp', last24h.toISOString()),
    supabase.from('violations').select('vehicle_type').gte('timestamp', todayStart.toISOString())
  ])

  const cameras = cameraRes.data ?? []
  const activeCount = cameras.filter(c => c.status === 'ACTIVE').length
  const maintenanceCount = cameras.filter(c => c.status === 'MAINTENANCE').length

  const hourlyMap: Record<number, Record<string, number>> = {}
  for (let h = 0; h < 24; h++) hourlyMap[h] = {}
  ;(hourlyRes.data ?? []).forEach(v => {
    const h = new Date(v.timestamp).getHours()
    hourlyMap[h][v.type] = (hourlyMap[h][v.type] ?? 0) + 1
  })
  const hourlyData = Object.entries(hourlyMap).map(([hour, types]) => ({ hour: parseInt(hour), ...types }))

  const vehicleMap: Record<string, number> = {}
  ;(vehicleRes.data ?? []).forEach(v => {
    vehicleMap[v.vehicle_type] = (vehicleMap[v.vehicle_type] ?? 0) + 1
  })
  const vehicleTypeData = Object.entries(vehicleMap).map(([type, count]) => ({ type, count }))

  const todayCount = todayRes.count ?? 0
  const yesterdayCount = yesterdayRes.count ?? 1
  const trend = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)

  return NextResponse.json({
    todayCount,
    trend,
    activeCount,
    maintenanceCount,
    totalCameras: cameras.length,
    anprAccuracy: 96.8,
    avgResponseTime: 4.2,
    hourlyData,
    vehicleTypeData
  })
}
