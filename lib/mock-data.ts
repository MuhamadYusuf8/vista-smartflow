import { VehicleType, ViolationType, CameraStatus, ViolationStatus } from "@prisma/client";

export function generatePlate(): string {
  const prefixes = ['B', 'F', 'D', 'Z', 'E', 'T', 'A'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9000) + 1000;
  const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                 String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                 String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix} ${number} ${suffix}`;
}

export function generateCameras() {
  const locations = [
    { name: "CCTV - Jl. Sudirman 1", location: "Jl. Jend. Sudirman", lat: -6.2231, lng: 106.8041 },
    { name: "CCTV - Jl. Sudirman 2", location: "Jl. Jend. Sudirman", lat: -6.2163, lng: 106.8166 },
    { name: "CCTV - Jl. Thamrin 1", location: "Jl. MH Thamrin", lat: -6.1920, lng: 106.8225 },
    { name: "CCTV - Jl. Thamrin 2", location: "Jl. MH Thamrin", lat: -6.1852, lng: 106.8239 },
    { name: "CCTV - Jl. Gatot Subroto 1", location: "Jl. Gatot Subroto", lat: -6.2307, lng: 106.8232 },
    { name: "CCTV - Jl. Gatot Subroto 2", location: "Jl. Gatot Subroto", lat: -6.2384, lng: 106.8066 },
    { name: "CCTV - Jl. Rasuna Said 1", location: "Jl. HR Rasuna Said", lat: -6.2155, lng: 106.8291 },
    { name: "CCTV - Jl. Casablanca", location: "Jl. Casablanca", lat: -6.2227, lng: 106.8407 },
    { name: "CCTV - Jl. MT Haryono", location: "Jl. MT Haryono", lat: -6.2422, lng: 106.8631 },
    { name: "CCTV - Stasiun Tanah Abang", location: "Stasiun Tanah Abang", lat: -6.1852, lng: 106.8115 },
    { name: "CCTV - Stasiun Kota", location: "Kawasan Stasiun Kota", lat: -6.1376, lng: 106.8149 },
    { name: "CCTV - Bundaran HI", location: "Bundaran HI", lat: -6.1947, lng: 106.8230 },
    { name: "CCTV - Pasar Minggu", location: "Jl. Raya Pasar Minggu", lat: -6.2841, lng: 106.8437 }
  ];

  const cameras = [];
  
  // Create 52 cameras using variations of these
  for (let i = 0; i < 52; i++) {
    const baseLoc = locations[i % locations.length];
    
    // Add small random offset to lat/lng for spread
    const lat = baseLoc.lat + (Math.random() - 0.5) * 0.05;
    const lng = baseLoc.lng + (Math.random() - 0.5) * 0.05;
    
    let status: CameraStatus = CameraStatus.ACTIVE;
    const rand = Math.random();
    if (rand < 0.05) status = CameraStatus.MAINTENANCE;
    else if (rand < 0.1) status = CameraStatus.INACTIVE;

    cameras.push({
      name: `${baseLoc.name.split(' - ')[0]} ${i + 1} - ${baseLoc.name.split(' - ')[1]}`,
      location: baseLoc.location,
      lat,
      lng,
      status,
      streamUrl: status === CameraStatus.ACTIVE ? "https://example.com/stream" : null
    });
  }
  
  return cameras;
}

export function generateViolations(cameraIds: string[]) {
  const violations = [];
  const types = Object.values(ViolationType);
  const vehicles = Object.values(VehicleType);
  const statuses = Object.values(ViolationStatus);
  
  const now = new Date();
  
  for (let i = 0; i < 500; i++) {
    const cameraId = cameraIds[Math.floor(Math.random() * cameraIds.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const vehicleType = vehicles[Math.floor(Math.random() * vehicles.length)];
    
    const confidence = 0.65 + (Math.random() * 0.34); // 65-99%
    const duration = type === 'ILLEGAL_PARKING' ? Math.floor(Math.random() * 1200) + 60 : null;
    
    // Distribute timestamps over last 30 days
    const pastDate = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    
    let status: ViolationStatus = ViolationStatus.PENDING;
    const randStatus = Math.random();
    if (randStatus < 0.4) status = ViolationStatus.VERIFIED;
    else if (randStatus < 0.5) status = ViolationStatus.EXPORTED;
    else if (randStatus < 0.6) status = ViolationStatus.DISMISSED;

    // Use placeholder images that look roughly like a dashboard/car scene.
    const evidenceUrl = `https://picsum.photos/seed/${Math.floor(Math.random() * 10000)}/800/600`;

    // Coordinates roughly around Jakarta
    const lat = -6.2 + (Math.random() - 0.5) * 0.2;
    const lng = 106.8 + (Math.random() - 0.5) * 0.2;

    violations.push({
      cameraId,
      type,
      licensePlate: generatePlate(),
      vehicleType,
      confidence,
      duration,
      evidenceUrl,
      location: "Detected near " + cameraIds.indexOf(cameraId), // Will update with camera location in seed
      lat,
      lng,
      status,
      timestamp: pastDate,
      processedAt: status !== ViolationStatus.PENDING ? new Date(pastDate.getTime() + 3600000) : null,
      etleRef: status === ViolationStatus.EXPORTED ? `ETLE-${Math.floor(Math.random() * 90000) + 10000}` : null
    });
  }

  return violations;
}
