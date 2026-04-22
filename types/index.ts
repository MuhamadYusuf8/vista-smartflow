export type Role = 'ADMIN' | 'OFFICER' | 'VIEWER';
export type CameraStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type ViolationType =
  | 'ILLEGAL_PARKING'
  | 'BUSWAY_VIOLATION'
  | 'BICYCLE_LANE_VIOLATION'
  | 'BUS_STOP_VIOLATION'
  | 'WRONG_LANE';
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BUS' | 'TRUCK' | 'OTHER';
export type ViolationStatus = 'PENDING' | 'VERIFIED' | 'EXPORTED' | 'DISMISSED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: CameraStatus;
  streamUrl?: string;
  violationsToday?: number;
  uptime?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Violation {
  id: string;
  cameraId: string;
  camera?: Camera;
  type: ViolationType;
  licensePlate: string;
  vehicleType: VehicleType;
  confidence: number;
  duration?: number;
  evidenceUrl: string;
  location: string;
  lat: number;
  lng: number;
  status: ViolationStatus;
  timestamp: Date;
  processedAt?: Date;
  etleRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface AnalyticsData {
  todayCount: number;
  activeCount: number;
  totalCount: number;
  maintenanceCount: number;
  anprAccuracy: number;
  avgResponseTime: number;
  todayTrend: number;
  anprTrend: number;
  responseTrend: number;
  hourlyData: HourlyDataPoint[];
  vehicleTypeData: VehicleTypeDataPoint[];
  violationTypeData: ViolationTypeDataPoint[];
}

export interface HourlyDataPoint {
  hour: string;
  ILLEGAL_PARKING: number;
  BUSWAY_VIOLATION: number;
  BICYCLE_LANE_VIOLATION: number;
  BUS_STOP_VIOLATION: number;
  WRONG_LANE: number;
  total: number;
}

export interface VehicleTypeDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface ViolationTypeDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface PaginatedViolations {
  violations: Violation[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ViolationFilters {
  page?: number;
  limit?: number;
  type?: ViolationType;
  status?: ViolationStatus;
  cameraId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest' | 'duration' | 'confidence';
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
