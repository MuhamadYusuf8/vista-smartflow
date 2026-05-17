import { supabaseAdmin, ViolationType, VehicleType } from './supabase'

export interface DetectionPayload {
  cameraId: string
  cameraLocation: string
  licensePlate: string
  vehicleType: VehicleType
  violationType: ViolationType
  confidence: number
  duration?: number
  lat: number
  lng: number
  evidenceUrl?: string
}

export async function processDetection(payload: DetectionPayload) {
  const isVerified = payload.confidence >= 0.85

  const { data: violation, error } = await supabaseAdmin
    .from('violations')
    .insert({
      camera_id: payload.cameraId,
      license_plate: payload.licensePlate,
      vehicle_type: payload.vehicleType,
      type: payload.violationType,
      confidence: payload.confidence,
      duration: payload.duration ?? null,
      lat: payload.lat,
      lng: payload.lng,
      location: payload.cameraLocation,
      evidence_url: payload.evidenceUrl ?? null,
      status: isVerified ? 'VERIFIED' : 'PENDING',
      etle_ref: isVerified
        ? `ETLE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        : null,
      processed_at: isVerified ? new Date().toISOString() : null
    })
    .select()
    .single()

  if (error || !violation) return { success: false, error: error?.message }

  if (isVerified && payload.evidenceUrl) {
    await fetch(`${process.env.NEXTAUTH_URL}/api/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ violationId: violation.id, screenshotUrl: payload.evidenceUrl })
    }).catch(console.error)
  }

  return { success: true, violationId: violation.id, status: violation.status }
}
