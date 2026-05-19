"""
start_vista.py - Script Startup VISTA SmartFlow
================================================
Jalankan script ini SATU KALI untuk menjalankan semuanya:
  python start_vista.py

Script ini akan:
1. Tunggu Next.js (npm run dev) siap di port 3000
2. Baru jalankan AI Engine -- sehingga foto langsung ke Supabase
"""

import subprocess
import time
import sys
import os
import requests
import threading

NEXT_URL   = "http://localhost:3000"
NEXT_DIR   = os.path.dirname(os.path.abspath(__file__))
MAX_WAIT   = 120   # maksimal tunggu 120 detik
CHECK_INT  = 2     # cek setiap 2 detik


def is_server_ready() -> bool:
    try:
        r = requests.get(NEXT_URL, timeout=3)
        return r.status_code < 500
    except Exception:
        return False


def stream_output(proc: subprocess.Popen, prefix: str):
    """Print output dari subprocess dengan prefix label."""
    for line in iter(proc.stdout.readline, b""):
        print(f"[{prefix}] {line.decode('utf-8', errors='replace').rstrip()}")


def main():
    print("=" * 60)
    print("  VISTA SmartFlow -- Startup Script")
    print("=" * 60)

    # ── LANGKAH 1: Cek apakah Next.js sudah berjalan ──
    if is_server_ready():
        print(f"[OK] Next.js sudah berjalan di {NEXT_URL}")
    else:
        print("[>>] Menjalankan Next.js (npm run dev)...")
        next_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=NEXT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=True,
        )
        threading.Thread(target=stream_output, args=(next_proc, "Next.js"), daemon=True).start()

        print(f"[..] Menunggu Next.js siap (maks {MAX_WAIT} detik)...")
        waited = 0
        while waited < MAX_WAIT:
            if is_server_ready():
                print(f"\n[OK] Next.js siap di {NEXT_URL} (setelah {waited}s)")
                break
            time.sleep(CHECK_INT)
            waited += CHECK_INT
            print(f"   ... menunggu ({waited}s)", end="\r")
        else:
            print("\n[!!] Next.js tidak siap dalam waktu yang ditentukan.")
            print("     Pastikan tidak ada error di terminal npm.")
            next_proc.terminate()
            sys.exit(1)

    # ── LANGKAH 2: Jalankan AI Engine ──
    print("\n[AI] Menjalankan VISTA AI Engine...")
    print("     Foto bukti akan langsung upload ke Supabase")
    print("     Tekan Ctrl+C untuk menghentikan semua proses.\n")

    ai_proc = subprocess.Popen(
        [sys.executable, "ai_engine.py"],
        cwd=NEXT_DIR,
    )

    try:
        ai_proc.wait()
    except KeyboardInterrupt:
        print("\n\n[!!] Menghentikan VISTA AI Engine...")
        ai_proc.terminate()
        print("[OK] Selesai.")


if __name__ == "__main__":
    main()
