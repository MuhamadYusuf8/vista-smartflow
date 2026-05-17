import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type ViolationType = 'ILLEGAL_PARKING' | 'BUSWAY_VIOLATION' | 'BICYCLE_LANE_VIOLATION' | 'BUS_STOP_VIOLATION' | 'WRONG_LANE'
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BUS' | 'TRUCK' | 'OTHER'
export type ViolationStatus = 'PENDING' | 'VERIFIED' | 'EXPORTED' | 'DISMISSED'
export type CameraStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'

export interface Camera {
  id: string
  name: string
  location: string
  lat: number
  lng: number
  status: CameraStatus
  stream_url: string | null
  created_at: string
}

export interface Violation {
  id: string
  camera_id: string
  cameras?: Camera
  type: ViolationType
  license_plate: string
  vehicle_type: VehicleType
  confidence: number
  duration: number | null
  evidence_url: string | null
  location: string
  lat: number
  lng: number
  status: ViolationStatus
  timestamp: string
  processed_at: string | null
  etle_ref: string | null
  screenshot_sent: boolean
  created_at: string
}
