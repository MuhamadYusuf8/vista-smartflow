/**
 * Audit Trail System — VISTA SmartFlow AI
 * Fase 4: Mencatat semua tindakan krusial pengguna untuk akuntabilitas.
 * Menggunakan Supabase (bukan Prisma) agar konsisten dengan seluruh codebase.
 */

import { supabaseAdmin } from "./supabase";

export type AuditEvent =
  | "VIOLATION_VERIFIED"
  | "VIOLATION_DISMISSED"
  | "VIOLATION_EXPORTED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "CAMERA_UPDATED"
  | "SETTINGS_CHANGED"
  | "BULK_EXPORT"
  | "DATA_SYNC_ETLE";

interface AuditLogParams {
  event: AuditEvent;
  userId?: string;
  userEmail?: string;
  targetId?: string;
  details?: string;
  ipAddress?: string;
}

/**
 * Mencatat kejadian ke tabel SystemLog di database.
 * Fire-and-forget — tidak memblokir eksekusi utama.
 */
export async function logAudit({
  event,
  userId,
  userEmail,
  targetId,
  details,
  ipAddress,
}: AuditLogParams): Promise<void> {
  try {
    const detailJson = JSON.stringify({
      userId,
      userEmail,
      targetId,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
    });

    await supabaseAdmin.from("SystemLog").insert([
      {
        event,
        details: detailJson,
      },
    ]);
  } catch (err) {
    // Audit logging should never break the main application flow
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}

/**
 * Helper untuk format log menjadi teks yang mudah dibaca manusia.
 */
export function formatAuditDetails(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { details: raw };
  }
}
