/**
 * Script Setup Supabase Storage Bucket "evidence"
 * Jalankan SEKALI SAJA dari terminal Next.js: npx ts-node scripts/setup-storage.ts
 * Atau bisa setup manual via Supabase Dashboard.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_KEY di .env dulu!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  console.log("🔧 Setup Supabase Storage Bucket 'evidence'...");

  // Cek apakah bucket sudah ada
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "evidence");

  if (exists) {
    console.log("✅ Bucket 'evidence' sudah ada.");
  } else {
    // Buat bucket baru
    const { error } = await supabase.storage.createBucket("evidence", {
      public: true, // URL foto bisa diakses publik (penting untuk ditampilkan di browser)
      fileSizeLimit: 5 * 1024 * 1024, // Max 5MB per foto
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });

    if (error) {
      console.error("❌ Gagal membuat bucket:", error.message);
      process.exit(1);
    }
    console.log("✅ Bucket 'evidence' berhasil dibuat!");
  }

  // Set RLS Policy agar foto bisa dibaca publik
  console.log("📋 Semua selesai. Foto bukti akan disimpan di:");
  console.log(`   ${supabaseUrl}/storage/v1/object/public/evidence/violations/...`);
}

setupStorage().catch(console.error);
