/**
 * Utility: Send Telegram notification with exponential backoff retry.
 * Fase 1: Error Handling & Message Queue
 */

interface TelegramPayload {
  message: string;
  botToken: string;
  chatId: string;
  maxRetries?: number;
}

/**
 * Kirim pesan ke Telegram dengan retry otomatis jika gagal.
 * Menggunakan exponential backoff (1s → 2s → 4s).
 */
export async function sendTelegramWithRetry({
  message,
  botToken,
  chatId,
  maxRetries = 3,
}: TelegramPayload): Promise<{ success: boolean; attempts: number; error?: string }> {
  let attempts = 0;
  let lastError = "";

  while (attempts < maxRetries) {
    attempts++;
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );

      if (res.ok) {
        return { success: true, attempts };
      }

      const errorBody = await res.text();
      lastError = `HTTP ${res.status}: ${errorBody}`;
      console.warn(`[Telegram] Attempt ${attempts} failed: ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[Telegram] Attempt ${attempts} network error: ${lastError}`);
    }

    // Wait before next retry using exponential backoff: 1s, 2s, 4s
    if (attempts < maxRetries) {
      const delay = Math.pow(2, attempts - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(`[Telegram] All ${maxRetries} attempts failed. Last error: ${lastError}`);
  return { success: false, attempts, error: lastError };
}

/**
 * Format pesan tilang standar VISTA SmartFlow AI.
 */
export function formatViolationTelegramMessage(params: {
  cameraName: string;
  cameraLocation: string;
  licensePlate: string;
  violationType: string;
  confidence: number;
  etleRef: string;
}): string {
  const typeLabels: Record<string, string> = {
    ILLEGAL_PARKING: "🚫 Parkir Liar",
    BUSWAY_VIOLATION: "🚌 Pelanggaran Jalur Busway",
    BICYCLE_LANE_VIOLATION: "🚲 Pelanggaran Jalur Sepeda",
    BUS_STOP_VIOLATION: "🚏 Pelanggaran Halte Bus",
    WRONG_LANE: "🔀 Salah Lajur",
  };

  const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  return (
    `🚨 *PELANGGARAN TERDETEKSI*\n` +
    `VISTA SmartFlow AI — Dishub DKI Jakarta\n\n` +
    `📍 Lokasi: ${params.cameraLocation}\n` +
    `📹 Kamera: ${params.cameraName}\n` +
    `🚗 Plat Nomor: \`${params.licensePlate}\`\n` +
    `⚡ Jenis: ${typeLabels[params.violationType] ?? params.violationType}\n` +
    `🎯 Confidence AI: ${Math.round(params.confidence * 100)}%\n` +
    `🕒 Waktu: ${waktu} WIB\n` +
    `🏷 Ref: ${params.etleRef}\n` +
    `📋 Status: ✅ Terverifikasi`
  );
}
