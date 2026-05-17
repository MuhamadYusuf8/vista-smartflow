import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const iso = todayStart.toISOString()

  const [pending, verified, exported, alertsSent] = await Promise.all([
    supabase.from('violations').select('id', { count: 'exact' }).eq('status', 'PENDING').gte('timestamp', iso),
    supabase.from('violations').select('id', { count: 'exact' }).eq('status', 'VERIFIED').gte('timestamp', iso),
    supabase.from('violations').select('id', { count: 'exact' }).eq('status', 'EXPORTED').gte('timestamp', iso),
    supabase.from('violations').select('id', { count: 'exact' }).eq('screenshot_sent', true).gte('timestamp', iso)
  ])

  const total = (pending.count ?? 0) + (verified.count ?? 0) + (exported.count ?? 0)
  return NextResponse.json({
    total,
    pending: pending.count ?? 0,
    verified: verified.count ?? 0,
    exported: exported.count ?? 0,
    alertsSent: alertsSent.count ?? 0,
    healthy: true
  })
}
