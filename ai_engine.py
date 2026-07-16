"""
VISTA SmartFlow AI Engine v3.0 — Sprint 1: Core Data Pipeline
=============================================================
Fitur baru di v3.0:

1. Sighting Logger (BARU)
   - Setiap kendaraan yang terbaca platnya dikirim ke /api/vehicle-tracking/log
   - Cooldown 10 detik per plat per kamera (anti-spam)
   - Memungkinkan Vehicle Tracking lintas CCTV berjalan dengan data riil

2. Traffic Counter (BARU)
   - Setiap 60 detik, kirim jumlah kendaraan dalam frame ke /api/traffic-metrics
   - Digunakan oleh Traffic Forecast, ERP, dan Executive Dashboard

3. Pendeteksi Ganjil Genap Otomatis (v2.0)
   - Cek tanggal & jam saat ini -> tentukan plat mana yang melanggar
   - Hanya aktif di jam 06:00-10:00 & 16:00-21:00, hari kerja

4. Sterilisasi Jalur TransJakarta (Busway) (v2.0)
   - Poligon khusus zona busway
   - Jika kendaraan bukan 'bus' masuk zona -> tilang BUSWAY_VIOLATION

5. ANPR (Automatic Number Plate Recognition) (v2.0)
   - Menggunakan EasyOCR (ringan, tidak perlu GPU)
   - Crop region plat, OCR -> kirim ke API

Cara jalankan:
  pip install ultralytics easyocr opencv-python-headless requests numpy
  python ai_engine.py

Mode Headless (tanpa GUI):
  Jika OpenCV tidak support display window, engine tetap berjalan.
  Frame preview akan disimpan ke: output/preview_latest.jpg (update tiap detik)
  Pelanggaran tetap dikirim ke dashboard jika server aktif.
"""

import cv2
import requests
import random
import time
import base64
import re
import os
import json
import numpy as np
from datetime import datetime
from ultralytics import YOLO

# ============================================================
# CEK KEMAMPUAN GUI (headless detection)
# ============================================================
GUI_AVAILABLE = False
try:
    test_img = np.zeros((10, 10, 3), dtype=np.uint8)
    cv2.imshow("_test", test_img)
    cv2.waitKey(1)
    cv2.destroyWindow("_test")
    GUI_AVAILABLE = True
except Exception:
    GUI_AVAILABLE = False

if not GUI_AVAILABLE:
    print("ℹ️  Mode Headless aktif — tidak ada jendela GUI.")
    print("   Preview disimpan ke: output/preview_latest.jpg")
    os.makedirs("output", exist_ok=True)

# Antrian offline: simpan pelanggaran jika server tidak aktif
offline_queue = []
OFFLINE_QUEUE_FILE = "output/offline_queue.json"
if os.path.exists(OFFLINE_QUEUE_FILE):
    try:
        with open(OFFLINE_QUEUE_FILE, "r") as f:
            offline_queue = json.load(f)
        print(f"📦 Memuat {len(offline_queue)} pelanggaran dari antrian offline.")
    except Exception:
        offline_queue = []

last_preview_save = 0  # throttle preview save

# ============================================================
# KONFIGURASI SISTEM
# ============================================================
print("🚀 Memuat AI Engine VISTA SmartFlow v2.0 ...")

model = YOLO('yolov8s.pt')
video_path = 'public/traffic-hd.mp4'

API_URL               = "http://localhost:3000/api/violations"
EVIDENCE_UPLOAD_URL   = "http://localhost:3000/api/upload-evidence"
GANJIL_GENAP_API      = "http://localhost:3000/api/ganjil-genap"
SIGHTING_LOG_URL      = "http://localhost:3000/api/vehicle-tracking/log"
TRAFFIC_METRICS_URL   = "http://localhost:3000/api/traffic-metrics"
CAMERA_ID             = "cctv-bhi-01"
LOCATION              = "Bundaran HI, Jl. MH Thamrin"

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print("❌ Error: Video tidak bisa dibuka!")
    exit()

v_width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
v_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# ============================================================
# FASE 1A: GANJIL GENAP — Status Manager
# ============================================================
class GanjilGenapManager:
    """
    Manager kebijakan Ganjil Genap Jakarta.
    Update setiap 60 detik dari API agar real-time.
    """
    HOLIDAYS = {
        "2025-01-01", "2025-03-30", "2025-03-31", "2025-04-18",
        "2025-05-01", "2025-08-17", "2025-12-25",
        "2026-01-01", "2026-08-17", "2026-12-25",
    }

    def __init__(self):
        self.is_enforced = False
        self.restricted_plate_type = None  # "GANJIL" atau "GENAP"
        self.date_is_odd = None
        self.last_update = 0

    def update(self):
        """Ambil status Ganjil Genap dari API setiap 60 detik."""
        if time.time() - self.last_update < 60:
            return

        try:
            resp = requests.get(GANJIL_GENAP_API, timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                policy = data.get("policy", {})
                self.is_enforced = policy.get("isEnforced", False)
                self.restricted_plate_type = policy.get("restrictedPlate")
                self.date_is_odd = policy.get("dateIsOdd")
                print(f"[Gage] Status: {'🚫 AKTIF' if self.is_enforced else '✅ Tidak Aktif'} | Dilarang: {self.restricted_plate_type}")
            self.last_update = time.time()
        except Exception as e:
            # Fallback: hitung secara lokal
            self._local_calculate()

    def _local_calculate(self):
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        if now.weekday() >= 5 or date_str in self.HOLIDAYS:
            self.is_enforced = False
            return
        hour = now.hour
        in_session = (6 <= hour < 10) or (16 <= hour < 21)
        if in_session:
            self.is_enforced = True
            self.date_is_odd = now.day % 2 != 0
            self.restricted_plate_type = "GENAP" if self.date_is_odd else "GANJIL"
        else:
            self.is_enforced = False

    def is_plate_violating(self, plate: str) -> bool:
        """Return True jika plat melanggar kebijakan Gage hari ini."""
        if not self.is_enforced or not self.restricted_plate_type:
            return False
        digits = re.sub(r'\D', '', plate)
        if not digits:
            return False
        last_digit = int(digits[-1])
        plate_is_even = last_digit % 2 == 0
        if self.restricted_plate_type == "GENAP" and plate_is_even:
            return True
        if self.restricted_plate_type == "GANJIL" and not plate_is_even:
            return True
        return False


gage = GanjilGenapManager()
gage.update()

# ============================================================
# SPRINT 1 — SIGHTING LOGGER
# Mencatat setiap kendaraan yang terdeteksi platnya ke DB.
# Cooldown 10 detik per plat per kamera agar tidak membanjiri DB.
# ============================================================
class SightingLogger:
    """
    Mengirim log sighting kendaraan ke /api/vehicle-tracking/log.
    Thread-safe via dictionary timestamp per (plate, camera).
    """
    COOLDOWN_SECONDS = 10  # jeda minimal antar sighting untuk plat+kamera yang sama

    def __init__(self):
        self._last_sent: dict = {}  # key: (plate, camera_id) -> timestamp

    def log(self, plate: str, camera_id: str, vehicle_type: str = "CAR",
            confidence: float = 0.85, speed_kmh: float | None = None,
            direction: str | None = None):
        """
        Kirim sighting ke API jika belum dalam cooldown.
        Non-blocking: jika server tidak aktif, diam saja (tidak queue).
        """
        key = (plate, camera_id)
        now = time.time()
        if now - self._last_sent.get(key, 0) < self.COOLDOWN_SECONDS:
            return  # masih dalam cooldown

        self._last_sent[key] = now
        payload = {
            "license_plate": plate,
            "camera_id":     camera_id,
            "vehicle_type":  vehicle_type.upper(),
            "confidence":    round(confidence, 3),
            "speed_kmh":     speed_kmh,
            "direction":     direction,
        }
        try:
            resp = requests.post(SIGHTING_LOG_URL, json=payload, timeout=3)
            if resp.status_code == 201:
                flagged = resp.json().get("sighting", {}).get("is_flagged", False)
                flag_icon = " 🚨 PANTAU!" if flagged else ""
                print(f"  👁  Sighting: {plate} — Cam:{camera_id}{flag_icon}")
        except requests.exceptions.ConnectionError:
            pass  # server belum aktif, abaikan
        except Exception as e:
            print(f"  ⚠️  Sighting log gagal: {e}")


# ============================================================
# SPRINT 1 — TRAFFIC COUNTER
# Mengirim jumlah kendaraan dalam frame ke /api/traffic-metrics
# setiap 60 detik untuk mendukung Traffic Forecast & ERP.
# ============================================================
class TrafficCounter:
    """
    Menghitung kendaraan dalam frame dan mengirimnya ke API
    setiap INTERVAL_SECONDS detik.
    """
    INTERVAL_SECONDS = 60

    def __init__(self, camera_id: str):
        self.camera_id    = camera_id
        self._count       = 0
        self._speed_sum   = 0.0
        self._speed_count = 0
        self._last_sent   = time.time()

    def record(self, vehicle_count_in_frame: int, avg_speed: float | None = None):
        """Catat jumlah kendaraan dari satu frame."""
        self._count = max(self._count, vehicle_count_in_frame)  # ambil nilai maksimum
        if avg_speed is not None:
            self._speed_sum   += avg_speed
            self._speed_count += 1

    def flush_if_due(self):
        """Kirim statistik ke API jika sudah waktunya (setiap INTERVAL_SECONDS)."""
        now = time.time()
        if now - self._last_sent < self.INTERVAL_SECONDS:
            return

        count       = self._count
        avg_speed   = round(self._speed_sum / self._speed_count, 1) if self._speed_count > 0 else None
        congestion  = round(min(1.0, max(0.0, (count - 3) / 25)), 2)

        # Reset counter
        self._count       = 0
        self._speed_sum   = 0.0
        self._speed_count = 0
        self._last_sent   = now

        payload = {
            "camera_id":     self.camera_id,
            "vehicle_count": count,
            "avg_speed_kmh": avg_speed,
            "congestion":    congestion,
        }
        try:
            resp = requests.post(TRAFFIC_METRICS_URL, json=payload, timeout=3)
            if resp.status_code == 201:
                level = "LANCAR" if congestion < 0.3 else "PADAT" if congestion < 0.55 else "MACET" if congestion < 0.8 else "MACET TOTAL"
                print(f"  📊 Traffic Metrics: {count} kendaraan | Kemacetan: {level} ({congestion:.0%}) | Cam:{self.camera_id}")
        except requests.exceptions.ConnectionError:
            pass
        except Exception as e:
            print(f"  ⚠️  Traffic metrics gagal: {e}")


sighting_logger  = SightingLogger()
traffic_counter  = TrafficCounter(CAMERA_ID)

# ============================================================
# FASE 1B: ZONA BUSWAY — Sterilisasi Jalur TransJakarta
# ============================================================
# Zona busway: lajur paling kiri video (asumsi kamera Bundaran HI)
busway_zone = np.array([
    [0, int(v_height * 0.35)],
    [int(v_width * 0.20), int(v_height * 0.35)],
    [int(v_width * 0.14), v_height],
    [0, v_height],
], np.int32)

# ============================================================
# FASE 1A: ZONA PARKIR LIAR (existing)
# ============================================================
parking_zone = np.array([
    [int(v_width * 0.80), int(v_height * 0.40)],
    [v_width, int(v_height * 0.40)],
    [v_width, v_height],
    [int(v_width * 0.72), v_height],
], np.int32)

# ============================================================
# FASE 1C: ANPR (Automatic Number Plate Recognition)
# ============================================================
anpr_available = False
ocr_reader = None

try:
    import easyocr
    ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    anpr_available = True
    print("✅ ANPR (EasyOCR) berhasil dimuat — Plat nomor akan dibaca otomatis!")
except ImportError:
    print("⚠️ EasyOCR tidak tersedia. Gunakan 'pip install easyocr' untuk ANPR asli.")
    print("   Saat ini menggunakan mode demo (plat deterministik).")


# Regex format plat Indonesia: huruf(1-2) spasi angka(1-4) spasi huruf(0-3)
# Contoh: B 1234 CD, AB 5678 F, D 99 ABC
_PLATE_RE = re.compile(r'^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$')


def _preprocess_plate(crop: np.ndarray) -> list:
    """
    Buat beberapa variasi preprocessing dari 1 crop gambar.
    Makin banyak variasi, makin besar peluang OCR berhasil baca.
    """
    results = []
    # Upscale 3x dulu
    h, w = crop.shape[:2]
    if w < 10 or h < 5:
        return results
    big = cv2.resize(crop, (max(w * 3, 120), max(h * 3, 40)), interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(big, cv2.COLOR_BGR2GRAY)

    # Variasi 1: CLAHE (bagus untuk malam/gelap)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    v1 = clahe.apply(gray)
    results.append(v1)

    # Variasi 2: Otsu threshold
    _, v2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(v2)

    # Variasi 3: Adaptive threshold (bagus untuk pencahayaan tidak merata)
    v3 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                cv2.THRESH_BINARY, 15, 4)
    results.append(v3)

    # Variasi 4: Invert (plat gelap dengan tulisan terang)
    v4 = cv2.bitwise_not(v2)
    results.append(v4)

    return results


def _score_plate(text: str) -> int:
    """Nilai seberapa 'valid' sebuah teks sebagai plat Indonesia. Makin tinggi makin baik."""
    t = re.sub(r'\s+', ' ', text.strip())
    if len(t) < 4:
        return 0
    score = 0
    # Ada huruf dan angka?
    if re.search(r'[A-Z]', t): score += 2
    if re.search(r'\d', t):   score += 2
    # Cocok format plat Indonesia?
    if _PLATE_RE.match(t):    score += 5
    # Panjang ideal plat (5–9 karakter)
    if 5 <= len(t) <= 9:      score += 2
    return score


def read_plate_ocr(frame: np.ndarray, box: tuple) -> str | None:
    """
    Baca plat nomor dari region kendaraan menggunakan EasyOCR.
    Strategi multi-region: coba 4 posisi crop, ambil hasil terbaik.
    Mengembalikan string plat jika terdeteksi, atau None jika gagal.
    """
    if not anpr_available or ocr_reader is None:
        return None

    x1, y1, x2, y2 = [int(v) for v in box]
    h_box = y2 - y1
    w_box = x2 - x1

    if h_box < 20 or w_box < 20:
        return None

    # Scan 4 area crop berbeda agar tidak miss posisi plat
    regions = [
        frame[y1 + int(h_box * 0.60): y2,               x1: x2],              # 40% bawah
        frame[y1 + int(h_box * 0.70): y2,               x1: x2],              # 30% bawah
        frame[y1 + int(h_box * 0.50): y1 + int(h_box * 0.85), x1: x2],       # tengah-bawah
        frame[y1 + int(h_box * 0.55): y2,               x1 + int(w_box*0.1): x2 - int(w_box*0.1)],  # bawah, crop sisi
    ]

    best_text  = None
    best_score = 0

    found_good = False
    for crop in regions:
        if crop.size == 0 or found_good:
            break
        for processed in _preprocess_plate(crop):
            try:
                res = ocr_reader.readtext(
                    processed,
                    detail=0,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
                    min_size=10,
                    text_threshold=0.6,
                    low_text=0.3,
                )
                if not res:
                    continue
                raw     = " ".join(res).upper().strip()
                cleaned = re.sub(r'[^A-Z0-9\s]', '', raw).strip()
                cleaned = re.sub(r'\s+', ' ', cleaned)
                if len(cleaned) < 4:
                    continue
                score = _score_plate(cleaned)
                if score > best_score:
                    best_score = score
                    best_text  = cleaned[:12]
                # ✅ OPTIMASI: Berhenti lebih awal jika plat sudah sangat valid
                # (format cocok regex plat Indonesia, ada huruf + angka, panjang ideal)
                if best_score >= 7:
                    found_good = True
                    break
            except Exception:
                continue

    # Hanya return jika skor cukup layak (ada huruf + angka minimal)
    if best_text and best_score >= 4:
        return best_text
    return None


def generate_plate_unknown(track_id: int) -> str:
    """Fallback jika OCR benar-benar gagal baca plat: pakai ID unik, BUKAN plat palsu."""
    return f"TDK-TERBACA-{track_id:04d}"


def get_cached_plate(frame: np.ndarray, box: tuple, track_id: int) -> str | None:
    """
    ✅ OPTIMASI UTAMA: Baca plat dengan smart caching per track_id.

    Strategi:
    - Jika sebelumnya BERHASIL dibaca  → langsung pakai cache (hemat 16 OCR calls).
    - Jika sebelumnya GAGAL (None)     → retry setelah PLATE_CACHE_RETRY_SECONDS.
    - Jika cache sudah terlalu lama    → refresh setelah PLATE_CACHE_REREAD_SECONDS.
    """
    now    = time.time()
    cached = plate_cache.get(track_id)

    if cached is not None:
        cached_text, cached_time = cached
        if cached_text is not None:
            # Sudah punya plat yang valid — pakai sampai REREAD timeout
            if now - cached_time < PLATE_CACHE_REREAD_SECONDS:
                return cached_text
        else:
            # Sebelumnya gagal baca — tunggu RETRY timeout sebelum coba lagi
            if now - cached_time < PLATE_CACHE_RETRY_SECONDS:
                return None

    result = read_plate_ocr(frame, box)
    plate_cache[track_id] = (result, now)
    return result


# ============================================================
# MEMORI ANTI-SPAM, TIMER & PLATE CACHE
# ============================================================
vehicle_timers    = {}
ticketed_vehicles = set()
ticketed_plates   = {}

# ✅ OPTIMASI: Cache hasil OCR per track_id agar tidak OCR ulang setiap frame.
# Format: { track_id: (plate_str | None, timestamp_last_attempt) }
plate_cache: dict[int, tuple[str | None, float]] = {}
PLATE_CACHE_REREAD_SECONDS = 30   # refresh cache setelah 30 detik
PLATE_CACHE_RETRY_SECONDS  = 5    # retry lebih cepat jika sebelumnya gagal baca

MAX_STOP_SECONDS       = 10
PLATE_COOLDOWN_SECONDS = 86400


def capture_evidence(frame, box, plate, track_id, violation_type="ILLEGAL_PARKING"):
    """
    Ambil foto bukti, tambahkan overlay informatif, upload ke API.
    """
    evidence_frame = frame.copy()
    x1, y1, x2, y2 = [int(v) for v in box]

    # Warna berdasarkan jenis pelanggaran
    vtype_color = {
        "ILLEGAL_PARKING": (0, 0, 255),
        "BUSWAY_VIOLATION": (0, 165, 255),
        "GANJIL_GENAP": (180, 0, 255),
    }.get(violation_type, (0, 0, 255))

    cv2.rectangle(evidence_frame, (x1, y1), (x2, y2), vtype_color, 4)

    # Label
    label_text = f"{violation_type.replace('_', ' ')}: {plate}"
    label_bg_y1 = max(0, y1 - 45)
    cv2.rectangle(evidence_frame, (x1, label_bg_y1), (x1 + 420, y1), vtype_color, -1)
    cv2.putText(evidence_frame, label_text, (x1 + 5, y1 - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

    # Watermark
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.rectangle(evidence_frame, (0, 0), (700, 70), (0, 0, 0), -1)
    cv2.putText(evidence_frame, "VISTA SmartFlow AI v2.0 — BUKTI PELANGGARAN",
                (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 200, 255), 2)
    cv2.putText(evidence_frame, f"CCTV-BHI-01  |  {ts}  |  ID:{track_id}",
                (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    # Resize
    h, w = evidence_frame.shape[:2]
    if w > 1280:
        scale = 1280 / w
        evidence_frame = cv2.resize(evidence_frame, (1280, int(h * scale)))

    _, buffer = cv2.imencode(".jpg", evidence_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    b64_image = base64.b64encode(buffer).decode("utf-8")

    try:
        filename = f"evidence_{track_id}_{int(time.time())}.jpg"
        resp = requests.post(EVIDENCE_UPLOAD_URL,
                             json={"image_base64": b64_image, "filename": filename}, timeout=10)
        if resp.status_code == 201:
            return resp.json().get("url")
    except requests.exceptions.ConnectionError:
        # Server tidak aktif — simpan evidence lokal
        local_path = f"output/{filename}"
        with open(local_path, "wb") as f:
            f.write(buffer.tobytes())
        print(f"   💾 Bukti disimpan lokal: {local_path}")
        return f"local://{local_path}"
    except Exception as e:
        print(f"❌ Error upload bukti: {e}")
    return None


def send_violation(camera_id, violation_type, plate, vehicle_class, confidence,
                   location, evidence_url=None, lat=None, lng=None):
    """Kirim data pelanggaran ke API Dashboard."""
    global offline_queue

    payload = {
        "camera_id": camera_id,
        "type": violation_type,
        "license_plate": plate,
        "vehicle_type": vehicle_class.upper(),
        "confidence": confidence,
        "location": location,
        "lat": lat or (-6.1944 + (random.random() - 0.5) * 0.002),
        "lng": lng or (106.8229 + (random.random() - 0.5) * 0.002),
        "evidence_url": evidence_url,
        "timestamp": datetime.now().isoformat(),
    }

    # Coba kirim antrian offline dulu
    if offline_queue:
        _flush_offline_queue()

    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        if response.status_code == 201:
            print(f"  ✅ Terkirim ke Dashboard: {violation_type} | {plate}")
            return True
        else:
            print(f"  ⚠️ API Error {response.status_code}: {response.text[:100]}")
    except requests.exceptions.ConnectionError:
        # Server belum aktif → simpan ke antrian offline
        offline_queue.append(payload)
        try:
            with open(OFFLINE_QUEUE_FILE, "w") as f:
                json.dump(offline_queue, f, indent=2)
        except Exception:
            pass
        print(f"  📦 [OFFLINE] Disimpan ke antrian ({len(offline_queue)} item). Jalankan Next.js untuk sync.")
    except Exception as e:
        print(f"  ❌ Koneksi gagal: {type(e).__name__}: {e}")
    return False


def _flush_offline_queue():
    """Coba kirim semua pelanggaran yang tersimpan saat offline."""
    global offline_queue
    if not offline_queue:
        return
    sent = []
    for payload in offline_queue:
        try:
            response = requests.post(API_URL, json=payload, timeout=5)
            if response.status_code == 201:
                sent.append(payload)
        except requests.exceptions.ConnectionError:
            break  # Server masih tidak aktif
        except Exception:
            break
    if sent:
        offline_queue = [p for p in offline_queue if p not in sent]
        with open(OFFLINE_QUEUE_FILE, "w") as f:
            json.dump(offline_queue, f, indent=2)
        print(f"  ✅ Sync offline: {len(sent)} pelanggaran terkirim. Sisa: {len(offline_queue)}")


# ============================================================
# MAIN LOOP
# ============================================================
print("\n" + "="*60)
print("  VISTA AI Engine v2.0 Aktif!")
print("  Memantau:")
print("  ✓ Parkir Liar (>10 detik)")
print(f"  ✓ Busway Sterilization")
print(f"  ✓ Ganjil Genap — Aktif: {gage.is_enforced}, Dilarang: {gage.restricted_plate_type}")
print(f"  ✓ ANPR: {'EasyOCR Aktif' if anpr_available else 'Mode Demo'}")
print("="*60 + "\n")

frame_count      = 0
last_annotated   = None  # frame terakhir yang sudah dianotasi (untuk frame skip display)

# ✅ OPTIMASI: Proses YOLO inference setiap N frame.
# Frame yang di-skip tetap ditampilkan dari cache last_annotated agar display mulus.
# N=2 → hemat ~50% beban CPU untuk inference tanpa kehilangan informasi tracking
# (BoT-SORT menggunakan Kalman Filter untuk memprediksi posisi di frame yang di-skip).
SKIP_FRAMES = 2

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Video selesai. Restart...", flush=True)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        # Bersihkan cache track yang sudah tidak relevan saat video restart
        plate_cache.clear()
        continue

    frame_count += 1

    # ── Frame skipping: tampilkan frame sebelumnya, lewati inference YOLO ──
    if frame_count % SKIP_FRAMES != 0:
        if last_annotated is not None:
            frame_resized = cv2.resize(last_annotated, (1024, 576))
            if GUI_AVAILABLE:
                cv2.imshow("VISTA AI Engine v3.0 — SmartFlow Jakarta", frame_resized)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            else:
                now_ts = time.time()
                if now_ts - last_preview_save >= 1.0:
                    cv2.imwrite("output/preview_latest.jpg", frame_resized)
                    last_preview_save = now_ts
        continue  # skip ke frame berikutnya tanpa memanggil YOLO

    # Update Ganjil Genap status setiap 60 detik
    if frame_count % 1800 == 0:  # ~60 detik pada 30fps
        gage.update()

    results = model.track(frame, persist=True, imgsz=640, conf=0.45,
                          tracker="botsort.yaml", stream=True)

    for r in results:
        annotated_frame = r.plot()

        # --- Gambar zona-zona ---
        # Zona parkir liar
        cv2.polylines(annotated_frame, [parking_zone], True, (0, 0, 255), 3)
        overlay_p = annotated_frame.copy()
        cv2.fillPoly(overlay_p, [parking_zone], (0, 0, 255))
        cv2.addWeighted(overlay_p, 0.15, annotated_frame, 0.85, 0, annotated_frame)
        cv2.putText(annotated_frame, "ZONA PARKIR LIAR", (int(v_width * 0.70), int(v_height * 0.37)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

        # Zona busway
        cv2.polylines(annotated_frame, [busway_zone], True, (0, 165, 255), 3)
        overlay_b = annotated_frame.copy()
        cv2.fillPoly(overlay_b, [busway_zone], (0, 165, 255))
        cv2.addWeighted(overlay_b, 0.15, annotated_frame, 0.85, 0, annotated_frame)
        cv2.putText(annotated_frame, "BUSWAY", (10, int(v_height * 0.33)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 165, 255), 2)

        # Status Ganjil Genap di HUD
        gage_text = f"GAGE: {'AKTIF - Dilarang Plat ' + (gage.restricted_plate_type or '') if gage.is_enforced else 'Tidak Aktif'}"
        gage_color = (0, 0, 255) if gage.is_enforced else (0, 200, 100)
        cv2.rectangle(annotated_frame, (0, v_height - 40), (500, v_height), (0, 0, 0), -1)
        cv2.putText(annotated_frame, gage_text, (10, v_height - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, gage_color, 2)

        # ANPR indicator
        anpr_text = f"ANPR: {'EasyOCR' if anpr_available else 'Demo Mode'}"
        cv2.putText(annotated_frame, anpr_text, (v_width - 250, v_height - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 200, 255), 1)

        if r.boxes.id is None:
            continue

        boxes      = r.boxes.xyxy.cpu().numpy()
        track_ids  = r.boxes.id.cpu().numpy()
        clss       = r.boxes.cls.cpu().numpy()
        confs      = r.boxes.conf.cpu().numpy()
        current_time = time.time()

        # ── SPRINT 1: Traffic Counter — hitung semua kendaraan dalam frame ──
        vehicle_count_frame = sum(
            1 for c in clss if model.names[int(c)] in ['car', 'truck', 'bus', 'motorcycle']
        )
        traffic_counter.record(vehicle_count_frame)
        traffic_counter.flush_if_due()

        for box, track_id, cls, conf in zip(boxes, track_ids, clss, confs):
            track_id   = int(track_id)
            class_name = model.names[int(cls)]

            x1, y1, x2, y2 = box
            center_x = int((x1 + x2) / 2)
            bottom_y = int(y2)

            cv2.circle(annotated_frame, (center_x, bottom_y), 5, (0, 255, 255), -1)

            is_in_parking_zone = cv2.pointPolygonTest(parking_zone, (center_x, bottom_y), False) >= 0
            is_in_busway_zone = cv2.pointPolygonTest(busway_zone, (center_x, bottom_y), False) >= 0

            if class_name not in ['car', 'truck', 'bus', 'motorcycle']:
                continue

            # --------------------------------------------------------
            # [1] PARKIR LIAR: kendaraan diam >10 detik di zona merah
            # --------------------------------------------------------
            if is_in_parking_zone:
                if track_id not in vehicle_timers:
                    vehicle_timers[track_id] = current_time

                time_spent = current_time - vehicle_timers[track_id]
                cv2.putText(annotated_frame, f"Stop: {int(time_spent)}s",
                            (int(x1), int(y1) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                            (0, 165, 255), 2)

                if time_spent >= MAX_STOP_SECONDS and track_id not in ticketed_vehicles:
                    # ✅ ANPR via cache — tidak OCR ulang jika sudah pernah dibaca
                    plate = get_cached_plate(frame, box, track_id) or generate_plate_unknown(track_id)

                    last_time = ticketed_plates.get(plate, 0)
                    if current_time - last_time < PLATE_COOLDOWN_SECONDS:
                        ticketed_vehicles.add(track_id)
                        continue

                    print(f"\n🚨 [PARKIR LIAR] ID:{track_id} | Plat:{plate}")
                    evidence_url = capture_evidence(frame, box, plate, track_id, "ILLEGAL_PARKING")
                    send_violation(CAMERA_ID, "ILLEGAL_PARKING", plate, class_name, 0.97,
                                   LOCATION, evidence_url)
                    ticketed_plates[plate] = current_time
                    ticketed_vehicles.add(track_id)

            else:
                if track_id in vehicle_timers:
                    del vehicle_timers[track_id]

            # --------------------------------------------------------
            # [2] BUSWAY VIOLATION: bukan bus masuk jalur busway
            # --------------------------------------------------------
            if is_in_busway_zone and class_name != 'bus':
                busway_key = f"busway_{track_id}"
                if busway_key not in ticketed_vehicles:
                    # ✅ ANPR via cache
                    plate = get_cached_plate(frame, box, track_id) or generate_plate_unknown(track_id)
                    last_time = ticketed_plates.get(plate + "_busway", 0)

                    if current_time - last_time > 300:  # cooldown 5 menit per plat
                        print(f"\n🟠 [BUSWAY] {class_name} ID:{track_id} | Plat:{plate}")
                        evidence_url = capture_evidence(frame, box, plate, track_id, "BUSWAY_VIOLATION")
                        send_violation(CAMERA_ID, "BUSWAY_VIOLATION", plate, class_name, 0.91,
                                       LOCATION, evidence_url)
                        ticketed_plates[plate + "_busway"] = current_time
                        ticketed_vehicles.add(busway_key)

                cv2.putText(annotated_frame, "⚠ BUSWAY!", (int(x1), int(y1) - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 165, 255), 2)

            # --------------------------------------------------------
            # [3] GANJIL GENAP: cek plat yang sudah dideteksi
            # --------------------------------------------------------
            if gage.is_enforced and class_name in ['car', 'truck']:
                gage_key = f"gage_{track_id}"
                if gage_key not in ticketed_vehicles:
                    # ✅ ANPR via cache
                    plate = get_cached_plate(frame, box, track_id) or generate_plate_unknown(track_id)
                    if gage.is_plate_violating(plate):
                        last_time = ticketed_plates.get(plate + "_gage", 0)
                        if current_time - last_time > 3600:  # cooldown 1 jam
                            print(f"\n🟣 [GANJIL-GENAP] Plat:{plate} dilarang hari ini!")
                            evidence_url = capture_evidence(frame, box, plate, track_id, "GANJIL_GENAP")
                            # Kirim sebagai WRONG_LANE (paling dekat kategorinya)
                            send_violation(CAMERA_ID, "WRONG_LANE", plate, class_name, 0.95,
                                           LOCATION + " — Pelanggaran Ganjil Genap", evidence_url)
                            ticketed_plates[plate + "_gage"] = current_time
                            ticketed_vehicles.add(gage_key)

            # ── SPRINT 1: Sighting Logger — catat semua kendaraan yang terbaca platnya ──
            # ✅ OPTIMASI: Gunakan cache yang sudah ada — TIDAK memanggil OCR lagi.
            # Jika cache belum ada untuk track_id ini, get_cached_plate akan OCR sekali
            # dan menyimpan hasilnya untuk dipakai di cek pelanggaran berikutnya juga.
            plate_for_sighting = get_cached_plate(frame, box, track_id)
            if plate_for_sighting and not plate_for_sighting.startswith("TDK-TERBACA"):
                sighting_logger.log(
                    plate        = plate_for_sighting,
                    camera_id    = CAMERA_ID,
                    vehicle_type = class_name.upper() if class_name in ['car', 'truck', 'bus', 'motorcycle'] else "OTHER",
                    confidence   = float(conf),
                )

    # Resize untuk display / simpan preview
    last_annotated = annotated_frame  # simpan untuk dipakai di frame skip
    frame_resized  = cv2.resize(annotated_frame, (1024, 576))

    if GUI_AVAILABLE:
        cv2.imshow("VISTA AI Engine v3.0 — SmartFlow Jakarta", frame_resized)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    else:
        # Mode headless: simpan preview tiap ~1 detik
        now_ts = time.time()
        if now_ts - last_preview_save >= 1.0:
            cv2.imwrite("output/preview_latest.jpg", frame_resized)
            last_preview_save = now_ts

    # ✅ Bersihkan cache plate untuk track_id yang sudah lama tidak muncul
    # agar memori tidak terus membesar. Jalankan setiap ~300 frame inference.
    if frame_count % (SKIP_FRAMES * 300) == 0 and plate_cache:
        active_ids = set(int(tid) for tid in track_ids) if 'track_ids' in dir() else set()
        stale_ids  = [tid for tid in list(plate_cache) if tid not in active_ids]
        for tid in stale_ids:
            plate_cache.pop(tid, None)
        if stale_ids:
            print(f"  🧹 Cache: hapus {len(stale_ids)} track_id lama. Sisa: {len(plate_cache)}", flush=True)

cap.release()
if GUI_AVAILABLE:
    cv2.destroyAllWindows()
print("\n✅ Sistem AI dimatikan dengan aman.")
if offline_queue:
    print(f"⚠️  {len(offline_queue)} pelanggaran masih di antrian offline.")
    print(f"   Jalankan 'npm run dev' lalu jalankan ulang ai_engine.py untuk sync.")