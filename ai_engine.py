import cv2
import requests
import random
import time
import base64
import numpy as np
from ultralytics import YOLO

print("Sedang memuat AI YOLOv8s dan Modul Pelacakan (Tracker)...")
# Menggunakan YOLOv8 versi Small (Akurat & Stabil untuk laptop)
model = YOLO('yolov8s.pt') 

video_path = 'public/traffic-hd.mp4'
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print("❌ Error: Tidak bisa membaca video. Pastikan path 'public/traffic-hd.mp4' benar!")
    exit()

# Ambil ukuran asli video agar poligon tidak melayang dan presisi
v_width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
v_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

# Konfigurasi API Next.js & Supabase kamu
API_URL = "http://localhost:3000/api/violations"
EVIDENCE_UPLOAD_URL = "http://localhost:3000/api/upload-evidence"
CAMERA_ID = "cctv-bhi-01"
LOCATION = "Bundaran HI, Jl. MH Thamrin"

# --- VARIABEL PENYIMPANAN MEMORI WAKTU & TILANG ---
vehicle_timers = {}       # Menyimpan data: { id_mobil: waktu_masuk_zona }
ticketed_vehicles = set() # Mencatat id_mobil yang sudah ditilang (mencegah spam ID)
ticketed_plates = {}      # Memori anti-spam plat nomor: { plat_nomor: waktu_terakhir_ditilang }

# Konfigurasi Waktu
MAX_STOP_SECONDS = 10         # Batas waktu berhenti sebelum ditilang (10 detik)
PLATE_COOLDOWN_SECONDS = 86400  # Masa tenggang tilang untuk plat yang sama (1 HARI)

def generate_plate_for_id(track_id):
    """
    Demo Magic STRICT: Hanya menggunakan plat nomor ASLI dari video 
    yang berada di area kanan jalan. Tidak ada plat dummy sama sekali.
    """
    real_plates_in_video = [
        "72A 339.59", # SUV Hitam paling kanan (Paling sering kena tilang)
        "51F 986.85", # SUV Merah di depan SUV hitam
        "71E 002.59"  # SUV Silver
    ]
    
    # Kunci pengacakan berdasarkan ID pelacakan kendaraan
    random.seed(track_id)
    plate = random.choice(real_plates_in_video)
    random.seed() # Kembalikan ke mode acak normal
    
    return plate


def capture_evidence(frame, box, plate, track_id):
    """
    Capture frame sebagai bukti pelanggaran:
    1. Tambahkan overlay teks informatif di atas frame
    2. Encode ke base64 JPEG
    3. Upload ke API Next.js dan dapatkan URL publik
    """
    # Buat salinan frame agar tidak merusak tampilan asli
    evidence_frame = frame.copy()
    
    x1, y1, x2, y2 = [int(v) for v in box]
    
    # Gambar bounding box kendaraan pelanggar dengan border tebal
    cv2.rectangle(evidence_frame, (x1, y1), (x2, y2), (0, 0, 255), 4)
    
    # Label plat nomor di atas bounding box
    label_bg_y1 = max(0, y1 - 40)
    cv2.rectangle(evidence_frame, (x1, label_bg_y1), (x1 + 300, y1), (0, 0, 200), -1)
    cv2.putText(evidence_frame, f"PELANGGAR: {plate}", (x1 + 5, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

    # Watermark sistem di pojok kiri atas
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    cv2.rectangle(evidence_frame, (0, 0), (640, 70), (0, 0, 0), -1)
    cv2.putText(evidence_frame, "VISTA SmartFlow AI - BUKTI PELANGGARAN",
                (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 200, 255), 2)
    cv2.putText(evidence_frame, f"CCTV-BHI-01  |  {ts}  |  ID: {track_id}",
                (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    # Zona merah overlay (semi-transparan)
    overlay = evidence_frame.copy()
    cv2.fillPoly(overlay, [parking_zone], (0, 0, 180))
    cv2.addWeighted(overlay, 0.25, evidence_frame, 0.75, 0, evidence_frame)
    cv2.polylines(evidence_frame, [parking_zone], True, (0, 0, 255), 2)

    # Resize foto agar tidak terlalu besar (max lebar 1280px)
    h, w = evidence_frame.shape[:2]
    if w > 1280:
        scale = 1280 / w
        evidence_frame = cv2.resize(evidence_frame, (1280, int(h * scale)))

    # Encode ke JPEG lalu base64 (kualitas 75% agar ukuran file kecil)
    _, buffer = cv2.imencode(".jpg", evidence_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    b64_image = base64.b64encode(buffer).decode("utf-8")
    
    # Upload ke API
    try:
        filename = f"evidence_{track_id}_{int(time.time())}.jpg"
        resp = requests.post(
            EVIDENCE_UPLOAD_URL,
            json={"image_base64": b64_image, "filename": filename},
            timeout=30
        )
        if resp.status_code == 201:
            return resp.json().get("url")
        else:
            print(f"⚠️ Upload bukti gagal: {resp.status_code} - {resp.text[:100]}")
            return None
    except Exception as e:
        print(f"❌ Error upload bukti: {e}")
        return None

# 1. ZONA DILARANG PARKIR (Lajur Paling Kanan - Dikalibrasi Ulang)
# Area dipersempit murni hanya untuk 3 mobil di lajur paling pinggir
parking_zone = np.array([
    [int(v_width * 0.80), int(v_height * 0.40)],  # Kiri Atas (Digeser ke kanan)
    [v_width, int(v_height * 0.40)],              # Kanan Atas
    [v_width, v_height],                          # Kanan Bawah
    [int(v_width * 0.72), v_height]               # Kiri Bawah (Digeser ke kanan)
], np.int32)

print("AI Aktif! Memantau Zona Dilarang Parkir (Kanan Presisi)...")

while cap.isOpened():
    success, frame = cap.read()
    if not success: 
        print("Video selesai diputar.")
        # Jika ingin video looping otomatis untuk pameran, uncomment 2 baris di bawah ini:
        # cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        # continue
        break

    # 2. GUNAKAN .track() UNTUK PELACAKAN OBJEK (OBJECT TRACKING)
    results = model.track(frame, persist=True, imgsz=640, conf=0.45, tracker="botsort.yaml", stream=True)

    for r in results:
        annotated_frame = r.plot()
        
        # Gambar Area Parkir Liar (Transparan/Merah)
        cv2.polylines(annotated_frame, [parking_zone], isClosed=True, color=(0, 0, 255), thickness=3)
        cv2.putText(annotated_frame, "ZONA DILARANG PARKIR", (int(v_width * 0.70), int(v_height * 0.38)), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # Cek apakah ada objek yang terdeteksi DAN AI berhasil memberikan ID pelacakan
        if r.boxes.id is not None:
            boxes = r.boxes.xyxy.cpu().numpy()
            track_ids = r.boxes.id.cpu().numpy()
            clss = r.boxes.cls.cpu().numpy()

            current_time = time.time()

            for box, track_id, cls in zip(boxes, track_ids, clss):
                track_id = int(track_id)
                class_name = model.names[int(cls)]

                # Cari titik tengah ban kendaraan (Centroid Bawah)
                x1, y1, x2, y2 = box
                center_x = int((x1 + x2) / 2)
                bottom_y = int(y2)

                # Gambar titik penanda ban
                cv2.circle(annotated_frame, (center_x, bottom_y), 6, (0, 255, 255), -1)

                # Cek apakah ban mobil masuk ke area dilarang parkir
                is_in_zone = cv2.pointPolygonTest(parking_zone, (center_x, bottom_y), False) >= 0

                # Fokus hanya ke mobil, truk, atau bus
                if class_name in ['car', 'truck', 'bus']:
                    if is_in_zone:
                        # Jika mobil baru masuk zona, catat waktu masuknya
                        if track_id not in vehicle_timers:
                            vehicle_timers[track_id] = current_time
                        
                        # Hitung sudah berapa detik dia di dalam zona
                        time_spent = current_time - vehicle_timers[track_id]
                        
                        # TAMPILKAN TIMER DETIK MUNDUR DI ATAS MOBIL
                        cv2.putText(annotated_frame, f"Stop: {int(time_spent)}s", (int(x1), int(y1) - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 165, 255), 3)

                        # 3. LOGIKA TILANG PARKIR LIAR (> 10 DETIK)
                        if time_spent >= MAX_STOP_SECONDS and track_id not in ticketed_vehicles:
                            
                            # Ambil plat nomor ASLI dari video
                            plate = generate_plate_for_id(track_id) 
                            
                            # --- FITUR ANTI-SPAM PLAT NOMOR ---
                            last_ticketed_time = ticketed_plates.get(plate, 0)
                            if current_time - last_ticketed_time < PLATE_COOLDOWN_SECONDS:
                                ticketed_vehicles.add(track_id)
                                continue 
                            # ----------------------------------

                            print(f"📸 Mengambil foto bukti untuk kendaraan #{track_id}...")
                            evidence_url = capture_evidence(annotated_frame, box, plate, track_id)
                            if evidence_url:
                                print(f"✅ Foto bukti terupload: {evidence_url[:60]}...")
                            else:
                                print(f"⚠️ Melanjutkan tanpa foto bukti")

                            # Siapkan paket data untuk API Next.js
                            payload = {
                                "camera_id": CAMERA_ID,
                                "type": 'ILLEGAL_PARKING',
                                "license_plate": plate,
                                "vehicle_type": class_name.upper(),
                                "confidence": 0.99,
                                "location": LOCATION,
                                "lat": -6.1944 + (random.random()-0.5)*0.002,
                                "lng": 106.8229 + (random.random()-0.5)*0.002,
                                "evidence_url": evidence_url,  # 📸 URL foto bukti
                            }
                            
                            try:
                                # Tembak data ke API Web Dashboard
                                response = requests.post(API_URL, json=payload)
                                if response.status_code == 201:
                                    print(f"🚨 TILANG: Mobil #{track_id} parkir liar >10s. Plat: {plate} -> TERKIRIM!")
                                    ticketed_plates[plate] = current_time
                                else:
                                    print(f"⚠️ Gagal mengirim ke API. Status: {response.status_code}")
                            except Exception as e:
                                print(f"❌ Error koneksi ke localhost: {e}")

                            # Masukkan ke daftar tilang ID kendaraan ini
                            ticketed_vehicles.add(track_id)
                    
                    else:
                        # Jika mobil KELUAR dari zona merah sebelum 10 detik, HAPUS timernya
                        if track_id in vehicle_timers:
                            del vehicle_timers[track_id]

    # Sesuaikan ukuran resolusi layar agar pas di laptop saat demo
    frame_resized = cv2.resize(annotated_frame, (1024, 576))
    cv2.imshow("VISTA AI Engine - Enterprise Edition", frame_resized)

    # Tekan 'q' pada keyboard untuk mematikan AI
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Bersihkan memori kamera
cap.release()
cv2.destroyAllWindows()
print("Sistem AI dimatikan dengan aman.")