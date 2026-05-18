# VISTA SmartFlow AI — Project Summary Lengkap

> Platform Intelligent Transport System (ITS) berbasis AI untuk Dinas Perhubungan DKI Jakarta.  
> Stack: **Next.js 15 App Router · TypeScript · Python (YOLOv8) · Supabase · PostgreSQL · deck.gl**

---

## 🏗️ Arsitektur Sistem

```mermaid
graph TD
    A[CCTV / Video Feed] --> B[ai_engine.py]
    B --> C[/api/violations]
    C --> D[Supabase DB]
    D --> E[Next.js Dashboard]
    E --> F[Telegram Bot Alert]
    E --> G[E-TLE Korlantas]
    E --> H[Supabase Storage]
```

---

## 📁 Struktur File Lengkap

### Root Files

| File | Ukuran | Fungsi |
|------|--------|--------|
| `ai_engine.py` | 18.6 KB | **Core AI Engine** — deteksi real-time via YOLOv8 |
| `yolov8s.pt` | 22.6 MB | Model YOLOv8 Small (deteksi kendaraan) |
| `yolov8n.pt` | 6.5 MB | Model YOLOv8 Nano (alternatif ringan) |
| `rtdetr-l.pt` | 66.5 MB | Model RT-DETR Large (akurasi tinggi) |
| `proxy.ts` | 2.5 KB | RTSP proxy untuk live CCTV stream |
| `docker-compose.yml` | 550 B | Konfigurasi deployment container |
| `Dockerfile` | 476 B | Build image production |

---

## 🐍 AI Engine (`ai_engine.py`) — Python

**File terpenting sistem.** Berjalan terpisah di server GPU/CPU, membaca video CCTV dan mengirim pelanggaran ke dashboard secara real-time.

### Fase 1A — Ganjil Genap Manager
```python
class GanjilGenapManager:
```
- Auto-deteksi tanggal ganjil/genap dari kalender
- Hanya aktif jam **06:00–10:00** dan **16:00–21:00**, hari kerja
- Skip hari libur nasional (hardcoded + API fallback)
- Cek angka terakhir plat nomor → flagging otomatis

### Fase 1B — Zona Deteksi (Polygon)
- **`parking_zone`** — Poligon merah zona parkir liar (koordinat pixel video)
- **`busway_zone`** — Poligon oranye jalur TransJakarta steril
- Menggunakan `cv2.pointPolygonTest()` untuk deteksi masuk zona

### Fase 1C — ANPR (EasyOCR)
```python
ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
```
- Import dengan `try/except` → graceful fallback ke mode demo jika tidak tersedia
- `read_plate_ocr()` — crop region kendaraan → OCR → regex clean hasil
- `generate_plate_demo()` — plat deterministik dari track_id jika OCR tidak aktif

### Main Detection Loop (3 Violation Types)

| # | Jenis | Trigger | Cooldown |
|---|-------|---------|----------|
| 1 | **ILLEGAL_PARKING** | Kendaraan diam >10 detik di zona merah | 24 jam per plat |
| 2 | **BUSWAY_VIOLATION** | Kendaraan bukan `bus` masuk zona busway | 5 menit per plat |
| 3 | **GANJIL_GENAP** | Plat terlarang saat kebijakan aktif | 1 jam per plat |

### `capture_evidence()` — Bukti Foto AI
- Buat frame kopi dengan bounding box berwarna
- Overlay watermark: `"VISTA SmartFlow AI v2.0 — BUKTI PELANGGARAN"`
- Timestamp + ID kamera + ID kendaraan
- Encode JPEG → Base64 → POST ke `/api/upload-evidence`

### `send_violation()` — Kirim ke Dashboard
- POST ke `http://localhost:3000/api/violations`
- Payload: `camera_id, type, license_plate, vehicle_type, confidence, location, lat, lng, evidence_url`

---

## 🌐 Next.js App — Pages (19 Halaman)

### 📊 Halaman Utama (Operasional)

#### `/` — Dashboard Utama
- Live counter pelanggaran hari ini
- Traffic simulation 3D (komponen `TrafficSimulation3D.tsx`)
- Feed pelanggaran terbaru (real-time dari Supabase)
- Status kamera aktif

#### `/violations` — Manajemen Pelanggaran
- Tabel dengan filter status (PENDING/VERIFIED/EXPORTED)
- Bulk select + export ke E-TLE Korlantas
- Update status → trigger audit log + Telegram notifikasi
- Pagination server-side

#### `/cameras` — Monitor CCTV
- Grid status 6 kamera pilot (aktif/maintenance)
- Live feed simulasi (`traffic-hd.mp4`)
- Koordinat GPS per kamera

#### `/heatmap` — Peta Hotspot 3D ⭐ Baru
- **deck.gl HexagonLayer** — pillar 3D WebGL
- **MapLibre** + Carto Dark Matter + **3D Buildings** (`fill-extrusion`)
- 3.000+ titik dari DB atau mock Jakarta (10 hotspot center)
- Filter per jenis pelanggaran + rentang waktu
- Glassmorphism cyberpunk UI sidebar
- AI Insight floating card

#### `/peta` — Peta Lalu Lintas
- React Map GL dengan marker kamera
- Rute TransJakarta overlay

---

### 🔬 Pilot Koridor (Fase 1 Roadmap)

#### `/executive` — Executive View
- Dashboard pimpinan Dishub
- Live counter dengan animasi (violations, PAD, kecepatan)
- Status 6 kamera pilot real-time
- Timeline jam-an (Recharts AreaChart)
- Estimasi PAD harian: `violations × 30% × Rp250.000`

#### `/accident-prediction` — Prediksi Kecelakaan AI
- Model risiko per persimpangan (5 lokasi nyata Jakarta)
- Radar chart risiko (Recharts)
- Prakiraan risiko 24 jam ke depan (BarChart)
- Tombol "Alert Satgas" one-click per persimpangan
- Risk score: 0–100 dengan threshold merah/kuning/hijau

---

### 🏙️ Smart City (Fase 2 Roadmap)

#### `/command-center` — War Room Command Center
- Multi-source incident feed (VISTA + JAKI + TMC + Polri + Waze)
- New incidents auto-appear tiap ~28 detik
- **DISPATCH** button → assign responder, ubah status
- Level eskalasi (CRITICAL / HIGH / MEDIUM)
- Statistik respons time real-time

#### `/anpr-national` — Database Nasional ANPR
- Cek plat ke 4 database: Polri, DPO, SAMSAT, BPKB
- 2% plat flagged DPO/curian (realistis)
- Live auto-feed dari violations DB Supabase
- Alert Polisi otomatis jika DPO terdeteksi
- Tilang E-TLE otomatis jika SAMSAT mati

#### `/carbon-tracker` — Emisi CO₂ Real-time
- Formula emisi IPCC: `volume × vehicle_mix × emission_factor × avg_trip`
- Toggle Ganjil-Genap → emisi turun 18% real-time
- Breakdown per 5 koridor utama
- Proyeksi tahunan vs baseline RPJMD DKI 4.2 juta ton/tahun
- Laporan bulanan → KLHK (PDF export)

#### `/adaptive-traffic` — Lampu Merah Adaptif AI
- Alokasi fase hijau: `NS_green = available × (NS_vol / total_vol)`
- 5 simpang Jakarta dengan status AI/Manual
- Visualisasi sinyal lampu hidup (animasi glow)
- AI Decision Reasoning text per simpang
- Perbandingan: AI Adaptive vs Jadwal Tetap (hemat 23%)

---

### 🏛️ Kebijakan Jakarta

#### `/ganjil-genap` — Ganjil Genap Monitor
- Status kebijakan real-time (aktif/tidak)
- Jam berlaku + plat yang dilarang hari ini
- Sinkron dengan `GanjilGenapManager` di `ai_engine.py`

#### `/erp` — ERP / Tarif Jalan Tol Dinamis
- Simulasi heuristik tarif berdasarkan volume jam-an
- 8 ruas jalan dengan tarif Rp0–Rp50.000
- Proyeksi PAD dari ERP

---

### 🤝 Integrasi Warga

#### `/citizen-report` — Laporan Warga (JAKI Integration)
- Form laporan publik (foto + deskripsi + lokasi)
- Upload ke Supabase Storage bucket `citizen_reports`
- Status tracking laporan warga
- Integrasi konsep dengan aplikasi JAKI Pemprov DKI

---

### 📈 AI Analytics

#### `/traffic-forecast` — Prediksi Kemacetan
- Model prediksi berbasis pola jam + data historis violations
- Rekomendasi rute alternatif
- Simulasi 24 jam ke depan

#### `/vehicle-tracking` — Lacak Kendaraan
- Multi-kamera tracking concept
- Trajectory kendaraan mencurigakan

---

### 🌏 Ekspansi Global

#### `/expansion-hub` — VISTA Expansion Hub ⭐ Baru
- **Tab Indonesia**: 8 kota target (LIVE/READY/INTEREST/PIPELINE)
- **Tab ASEAN**: 5 negara (KL, Manila, HCMC, Bangkok, Phnom Penh)
- **SaaS Revenue Simulator** interaktif:
  - Slider kota klien (1–20)
  - 3 tier: Starter (Rp2.5M) / Smart City (Rp8M) / Metropolitan (Rp25M)
  - Real-time: Total Contract Value + Annual Recurring Revenue
- Timeline ekspansi 36 bulan
- Pricing cards dengan MOST POPULAR badge
- CTA: Pilot Project 3 bulan GRATIS untuk kota ke-2

---

### ⚙️ Admin

#### `/audit-log` — Audit Trail
- Log semua aksi krusial (verify, export, login, settings)
- Filter by event type
- Timestamp + user + target ID

#### `/reports` — Laporan Bulanan
- Export PDF/CSV violations per periode
- Summary statistik bulanan

#### `/settings` — Pengaturan Sistem
- Konfigurasi threshold AI
- Manajemen pengguna (ADMIN/OFFICER/VIEWER)
- Toggle fitur sistem

---

## 🔌 API Routes (19 Endpoints)

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/violations` | GET/POST/PATCH | CRUD violations + E-TLE export |
| `/api/alert` | POST | Kirim notifikasi Telegram Bot |
| `/api/upload-evidence` | POST | Upload foto bukti ke Supabase Storage |
| `/api/samsat` | GET | Cek status STNK (mock deterministik) |
| `/api/erp` | GET | Data tarif ERP real-time |
| `/api/traffic-forecast` | GET | Prediksi kemacetan 24 jam |
| `/api/ganjil-genap` | GET | Status kebijakan ganjil genap hari ini |
| `/api/cameras` | GET/PATCH | Manajemen data kamera |
| `/api/citizen-report` | GET/POST | Laporan warga |
| `/api/audit-log` | GET | Baca audit trail |
| `/api/export` | POST | Export CSV/E-TLE bulk |
| `/api/analytics` | GET | Statistik dashboard |
| `/api/automation` | POST | Trigger otomasi (screenshot, notif) |
| `/api/settings` | GET/POST | Baca/tulis konfigurasi sistem |
| `/api/vehicle-tracking` | GET | Data lacak kendaraan |
| `/api/heatmap` | GET | Data heatmap aggregated |
| `/api/auth/[...nextauth]` | ALL | Auth (NextAuth.js) |
| `/api/seed` | GET/POST | **Seed 350+ violations** ke DB |
| `/api/debug-tables` | GET | Cek struktur tabel DB |

---

## 📚 Library Files (`/lib`)

| File | Fungsi Utama |
|------|-------------|
| `supabase.ts` | Client Supabase (public + admin) |
| `prisma.ts` | Prisma ORM client singleton |
| `auth.ts` | NextAuth config + `getAuthSession()` helper |
| `audit.ts` | `logAudit()` — fire-and-forget audit logger |
| `telegram.ts` | `sendTelegramWithRetry()` + `formatViolationTelegramMessage()` |
| `pilot-data.ts` | Data engine koridor Sudirman (volume, speed, PAD, congestion factor) |
| `mock-data.ts` | Mock data fallback untuk demo |
| `automation.ts` | Logic otomasi (screenshot, notifikasi batch) |
| `utils.ts` | `cn()` className merger |

---

## 🧩 Components

| Komponen | Fungsi |
|----------|--------|
| `layout/Sidebar.tsx` | Navigasi sidebar dengan 8 group (Utama → Ekspansi Global) |
| `layout/Header.tsx` | Topbar dengan search plat + notifikasi |
| `TrafficSimulation3D.tsx` | Animasi 3D traffic di dashboard utama |
| `heatmap/HeatmapView.tsx` | Leaflet heatmap (versi lama, sekarang diganti deck.gl) |
| `dashboard/*` | Widget cards dashboard |
| `cameras/*` | Komponen monitor CCTV |
| `shared/*` | UI reusable (badges, tables, modals) |
| `providers.tsx` | SessionProvider NextAuth wrapper |

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

```sql
violations       -- Inti: semua pelanggaran (lat, lng, type, status, evidence_url)
cameras          -- Data kamera CCTV (lokasi GPS, status)
User             -- Akun pengguna (ADMIN/OFFICER/VIEWER)
SystemLog        -- Audit trail semua aksi kritikal
citizen_reports  -- Laporan warga via JAKI
app_settings     -- Key-value konfigurasi sistem
```

### Data yang sudah di-seed:
- **356 violations** dengan koordinat lat/lng nyata di 20 hotspot Jakarta
- Tersebar 30 hari ke belakang, bias jam sibuk (07–10, 17–19)
- Mix status: 55% PENDING / 35% VERIFIED / 10% EXPORTED

---

## ⚙️ Environment Variables (`.env`)

```env
# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
DATABASE_URL=

# Notifikasi
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## 🚀 Tech Stack & Dependencies

### Frontend
| Package | Versi | Fungsi |
|---------|-------|--------|
| `next` | 15.x | App Router + Server Actions |
| `react` | 19.x | UI Framework |
| `typescript` | 5.x | Type Safety |
| `tailwindcss` | 4.x | Styling |
| `react-map-gl` | 8.1 | Peta interaktif (MapLibre) |
| `maplibre-gl` | 5.24 | WebGL map engine |
| `deck.gl` | latest | WebGL 3D data visualization |
| `@deck.gl/aggregation-layers` | latest | HexagonLayer 3D |
| `recharts` | latest | Chart analytics |
| `lucide-react` | latest | Icons |
| `next-auth` | 4.x | Authentication |
| `@supabase/supabase-js` | latest | Database client |
| `@prisma/client` | latest | ORM |

### AI Engine (Python)
| Package | Fungsi |
|---------|--------|
| `ultralytics` | YOLOv8 object detection |
| `easyocr` | ANPR plate recognition |
| `opencv-python` | Video processing |
| `numpy` | Array operations |
| `requests` | HTTP ke API dashboard |

---

## 📊 Status Fitur

### ✅ Fully Operational
- Dashboard utama + violations table
- Camera monitor
- Heatmap 3D (deck.gl + MapLibre)
- Executive View, Accident Prediction
- Command Center War Room
- ANPR National DB checker
- Carbon Tracker
- Adaptive Traffic Light
- Expansion Hub + Revenue Simulator
- Audit Log
- Telegram Bot notifikasi
- Upload evidence ke Supabase Storage
- Seed DB `/api/seed`

### 🟡 Simulasi Realistis (Mock API)
- SAMSAT — data pemilik kendaraan deterministik
- ERP — tarif berbasis volume jam-an
- Traffic Forecast — model heuristik jam sibuk
- ANPR — fallback plat deterministik dari track_id

### 🔴 Butuh Infrastruktur Fisik
- RTSP CCTV asli (sekarang: `traffic-hd.mp4`)
- ATCS API Dishub (lampu lalu lintas)
- Korlantas E-TLE webhook resmi
- GPS sensor loop detector (untuk ERP fisik)

---

## 🎯 Statistik Sistem

| Metrik | Nilai |
|--------|-------|
| Total halaman dashboard | 19 halaman |
| Total API routes | 19 endpoint |
| Total data violations di DB | 356 records |
| Model AI | YOLOv8s (22.6 MB) |
| Jenis pelanggaran terdeteksi | 5 kategori |
| Hotspot lokasi seed | 20 titik Jakarta |
| Kota target ekspansi Indonesia | 8 kota |
| Negara target ASEAN | 5 negara |

