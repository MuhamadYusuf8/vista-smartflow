import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Mengambil kunci rahasia dari file .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Inisialisasi koneksi ke Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function useRealtimeViolations(callback: (payload: unknown) => void) {
  useEffect(() => {
    // Membuka saluran komunikasi Real-time dengan Supabase
    const channel = supabase
      .channel("realtime-violations")
      .on(
        "postgres_changes",
        {
          event: "INSERT", // Hanya dengarkan data yang baru masuk
          schema: "public",
          table: "violations", // PASTIKAN NAMA TABEL INI SAMA DENGAN DI SUPABASE KAMU
        },
        (payload) => {
          console.log("🚨 Data Tilang Baru Masuk dari AI!", payload.new);
          // Jalankan animasi di peta menggunakan data baru ini
          callback(payload.new);
        }
      )
      .subscribe();

    // Membersihkan memori saat halaman ditutup
    return () => {
      supabase.removeChannel(channel);
    };
  }, [callback]);
}