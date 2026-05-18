import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VIOLATION_LABELS: Record<string, string> = {
  ILLEGAL_PARKING: '🚫 Parkir Liar',
  BUSWAY_VIOLATION: '🚌 Pelanggaran Jalur Busway',
  BICYCLE_LANE_VIOLATION: '🚲 Pelanggaran Jalur Sepeda',
  BUS_STOP_VIOLATION: '🛑 Pelanggaran Halte Bus',
  WRONG_LANE: '⚠️ Salah Jalur'
}

export async function POST(req: NextRequest) {
  try {
    const { violationId, screenshotUrl } = await req.json()

    const { data: violation } = await supabaseAdmin
      .from('violations')
      .select('*, cameras(name, location)')
      .eq('id', violationId)
      .single()

    if (!violation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const TOKEN = process.env.TELEGRAM_BOT_TOKEN
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID

    if (!TOKEN || !CHAT_ID) {
      return NextResponse.json({ sent: false, reason: 'Telegram not configured' })
    }

    const caption = `🚨 *PELANGGARAN TERDETEKSI*
*VISTA SmartFlow AI — Dishub DKI Jakarta*

📍 *Lokasi:* ${(violation.cameras as any)?.location ?? violation.location}
🎥 *Kamera:* ${(violation.cameras as any)?.name ?? 'N/A'}
🚗 *Plat Nomor:* \`${violation.license_plate}\`
⚡ *Jenis:* ${VIOLATION_LABELS[violation.type] ?? violation.type}
🎯 *Confidence AI:* ${Math.round(violation.confidence * 100)}%
⏱ *Waktu:* ${new Date(violation.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
${violation.duration ? `⏳ *Durasi:* ${Math.floor(violation.duration / 60)}:${String(violation.duration % 60).padStart(2, '0')} menit\n` : ''
}🔖 *Ref:* \`${violation.id.slice(0, 8).toUpperCase()}\`
📋 *Status:* ${violation.status === 'VERIFIED' ? '✅ Terverifikasi' : '⏳ Menunggu verifikasi'}`

    let sent = false

    if (screenshotUrl?.startsWith('data:image')) {
      const base64 = screenshotUrl.split(',')[1]
      const buffer = Buffer.from(base64, 'base64')
      const form = new FormData()
      form.append('chat_id', CHAT_ID)
      form.append('caption', caption)
      form.append('parse_mode', 'Markdown')
      form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'violation.jpg')
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: 'POST', body: form })
      sent = res.ok
    } else {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: 'Markdown' })
      })
      sent = res.ok
    }

    if (sent) {
      await supabaseAdmin.from('violations').update({ screenshot_sent: true }).eq('id', violationId)
    }

    return NextResponse.json({ sent, violationId })
  } catch (err) {
    console.error('[Alert Error]', err)
    return NextResponse.json({ error: 'Alert failed' }, { status: 500 })
  }
}

export async function GET() {
  const configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  if (!configured) return NextResponse.json({ configured: false })
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)
    const data = await res.json()
    return NextResponse.json({ configured: true, bot: data.result?.username ?? null })
  } catch {
    return NextResponse.json({ configured: true, bot: null, error: 'Cannot reach Telegram' })
  }
}
