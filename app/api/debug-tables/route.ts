import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/debug-tables
 * Setup: Membuat tabel SystemLog jika belum ada, lalu test insert dan baca.
 * HAPUS FILE INI SETELAH SELESAI.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // Step 1: Buat tabel SystemLog jika belum ada
  const createResult = await supabaseAdmin.rpc("exec_sql", {
    query: `
      CREATE TABLE IF NOT EXISTS "SystemLog" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        event TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `,
  });

  // Jika RPC exec_sql belum ada, coba pakai REST langsung
  if (createResult.error) {
    results["create_via_rpc"] = { error: createResult.error.message };

    // Fallback: langsung insert — jika tabel ada akan berhasil
    // Jika tabel tidak ada, kita perlu user buat manual via Supabase Dashboard
    const testInsert = await supabaseAdmin.from("SystemLog").insert([
      { event: "DEBUG_TEST", details: JSON.stringify({ test: true }) }
    ]);

    if (testInsert.error?.message?.includes("schema cache")) {
      results["action_needed"] = "Tabel 'SystemLog' belum ada di database. Silakan buat manual via Supabase Dashboard > SQL Editor.";
      results["sql_to_run"] = `CREATE TABLE "SystemLog" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, event TEXT NOT NULL, details TEXT, created_at TIMESTAMPTZ DEFAULT now());`;
    } else {
      results["insert_test"] = { error: testInsert.error?.message ?? null, status: testInsert.status };
    }
  } else {
    results["create_table"] = "OK";

    // Step 2: Test insert
    const insertResult = await supabaseAdmin.from("SystemLog").insert([
      { event: "SYSTEM_INIT", details: JSON.stringify({ message: "Tabel SystemLog berhasil dibuat", timestamp: new Date().toISOString() }) }
    ]);
    results["insert"] = { error: insertResult.error?.message ?? null, status: insertResult.status };

    // Step 3: Read
    const readResult = await supabaseAdmin.from("SystemLog").select("*").limit(5);
    results["read"] = { error: readResult.error?.message ?? null, count: readResult.data?.length, data: readResult.data };
  }

  return NextResponse.json(results, { status: 200 });
}
