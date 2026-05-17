-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
ALTER PUBLICATION supabase_realtime ADD TABLE cameras;

CREATE TABLE cameras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','MAINTENANCE')),
  stream_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID REFERENCES cameras(id),
  type TEXT NOT NULL CHECK (type IN ('ILLEGAL_PARKING','BUSWAY_VIOLATION','BICYCLE_LANE_VIOLATION','BUS_STOP_VIOLATION','WRONG_LANE')),
  license_plate TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'CAR' CHECK (vehicle_type IN ('CAR','MOTORCYCLE','BUS','TRUCK','OTHER')),
  confidence FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  duration INTEGER,
  evidence_url TEXT,
  location TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','EXPORTED','DISMISSED')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  etle_ref TEXT,
  screenshot_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed cameras (real Jakarta locations)
INSERT INTO cameras (name, location, lat, lng, status, stream_url) VALUES
  ('CCTV-BHI-01',  'Bundaran HI, Jl. MH Thamrin',        -6.1944, 106.8229, 'ACTIVE',      'https://www.youtube.com/watch?v=RG9MjkQSVrM'),
  ('CCTV-SDM-01',  'Jl. Jend. Sudirman KM 2',             -6.2088, 106.8219, 'ACTIVE',      NULL),
  ('CCTV-GSB-01',  'Jl. Gatot Subroto, Jakarta Selatan',  -6.2297, 106.8231, 'MAINTENANCE', NULL),
  ('CCTV-CSB-01',  'Jl. Casablanca, Jakarta Selatan',     -6.2241, 106.8450, 'ACTIVE',      NULL),
  ('CCTV-MTH-01',  'Jl. MT Haryono, Jakarta Timur',       -6.2408, 106.8600, 'INACTIVE',    NULL);

-- Seed 120 realistic violations
INSERT INTO violations (camera_id, type, license_plate, vehicle_type, confidence, duration, location, lat, lng, status, timestamp)
SELECT
  c.id,
  (ARRAY['ILLEGAL_PARKING','BUSWAY_VIOLATION','BICYCLE_LANE_VIOLATION','BUS_STOP_VIOLATION'])[floor(random()*4+1)::int],
  (ARRAY['B','F','D','Z','E','T'])[floor(random()*6+1)::int]
    || ' ' || floor(random()*9000+1000)::int::text
    || ' ' || chr(65+floor(random()*26)::int) || chr(65+floor(random()*26)::int) || chr(65+floor(random()*26)::int),
  (ARRAY['CAR','MOTORCYCLE','BUS','TRUCK'])[floor(random()*4+1)::int],
  round((0.75 + random()*0.24)::numeric, 3),
  CASE WHEN random() > 0.5 THEN floor(random()*600+60)::int ELSE NULL END,
  c.location,
  c.lat + (random()-0.5)*0.01,
  c.lng + (random()-0.5)*0.01,
  (ARRAY['PENDING','VERIFIED','EXPORTED','DISMISSED'])[floor(random()*4+1)::int],
  NOW() - (random()*30 * INTERVAL '1 day')
FROM cameras c
CROSS JOIN generate_series(1,24);
