"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import {
  Save, UserCog, Settings2, Sliders, Server, Layout,
  Video, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff,
  Moon, Sun, Bell, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const tabs = [
  { id: "ai", name: "Sistem AI", icon: Sliders },
  { id: "kamera", name: "Kamera", icon: Video },
  { id: "users", name: "Pengguna", icon: UserCog, adminOnly: true },
  { id: "etle", name: "Integrasi E-TLE", icon: Server },
  { id: "preferences", name: "Preferensi", icon: Layout },
];

interface AppSettings {
  confidence_threshold: string;
  parking_duration_threshold: string;
  ai_model_version: string;
  etle_endpoint: string;
  etle_api_key: string;
}

interface EtleTestResult {
  status: "REACHABLE" | "TIMEOUT" | "UNREACHABLE" | "ERROR" | "UNKNOWN" | null;
  latencyMs?: number;
  testing?: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "VIEWER";

  const [activeTab, setActiveTab] = useState("ai");
  const [settings, setSettings] = useState<AppSettings>({
    confidence_threshold: "85",
    parking_duration_threshold: "300",
    ai_model_version: "YOLOv8s-v2.0",
    etle_endpoint: "https://api.etle.korlantas.polri.go.id/v1/sync",
    etle_api_key: "",
  });
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean; bot?: string } | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);
  const [etleTest, setEtleTest] = useState<EtleTestResult>({ status: null });
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "OFFICER" });
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  // Preferences state (localStorage)
  const [theme, setTheme] = useState("dark");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [language, setLanguage] = useState("id");

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.settings) {
        setSettings((prev) => ({ ...prev, ...json.settings }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSettings();
    fetch("/api/alert").then((r) => r.json()).then(setTelegramStatus).catch(() => {});
    if (typeof window !== "undefined") {
      setTheme(localStorage.getItem("pref_theme") ?? "dark");
      setNotifEnabled(localStorage.getItem("pref_notif") !== "false");
      setLanguage(localStorage.getItem("pref_lang") ?? "id");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "kamera" && cameras.length === 0) {
      supabase.from("cameras").select("*").order("name").then(({ data }) => {
        if (data) setCameras(data);
      });
    }
    if (activeTab === "users" && users.length === 0) {
      supabase.from("User").select("id, name, email, role, createdAt").order("createdAt").then(({ data }) => {
        if (data) setUsers(data);
      }, () => {});
    }
  }, [activeTab, cameras.length, users.length]);

  const updateStreamUrl = async (cameraId: string, url: string) => {
    await supabase.from("cameras").update({ stream_url: url }).eq("id", cameraId);
    setCameras((c) => c.map((cam) => cam.id === cameraId ? { ...cam, stream_url: url } : cam));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      // Save preferences to localStorage
      if (activeTab === "preferences") {
        localStorage.setItem("pref_theme", theme);
        localStorage.setItem("pref_notif", String(notifEnabled));
        localStorage.setItem("pref_lang", language);
        setSaveResult("success");
        return;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      setSaveResult(res.ok ? "success" : "error");
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
    }
  };

  const handleTestEtle = async () => {
    setEtleTest({ status: null, testing: true });
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: settings.etle_endpoint, apiKey: settings.etle_api_key }),
      });
      const json = await res.json();
      setEtleTest({ status: json.status, latencyMs: json.latencyMs, testing: false });
    } catch {
      setEtleTest({ status: "UNREACHABLE", testing: false });
    }
  };

  const handleUpdateUser = async (userId: string, newRole: string) => {
    await supabase.from("User").update({ role: newRole }).eq("id", userId);
    setUsers((u) => u.map((user) => user.id === userId ? { ...user, role: newRole } : user));
    setEditingUser(null);
  };

  const availableTabs = tabs.filter((t) => !t.adminOnly || userRole === "ADMIN");

  const etleStatusColors: Record<string, string> = {
    REACHABLE: "text-accent-green",
    TIMEOUT: "text-accent-amber",
    UNREACHABLE: "text-accent-red",
    ERROR: "text-accent-red",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1">
            Pengaturan Sistem
          </h1>
          <p className="text-sm text-text-muted">Konfigurasi model AI, pengguna, dan integrasi VISTA</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-all"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
          {saveResult === "success" && <CheckCircle2 className="h-4 w-4 text-accent-green" />}
          {saveResult === "error" && <XCircle className="h-4 w-4 text-accent-red" />}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all text-left",
                  activeTab === tab.id
                    ? "bg-accent-blue/10 text-accent-blue font-semibold border border-accent-blue/20"
                    : "text-text-muted hover:bg-bg-tertiary hover:text-white border border-transparent"
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 rounded-xl border border-border bg-bg-secondary p-6">

          {/* ── TAB: AI ── */}
          {activeTab === "ai" && (
            <div className="space-y-8 max-w-2xl">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Parameter Deteksi AI</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-text-secondary">
                      Ambang Batas Kepercayaan ANPR (Confidence Threshold)
                    </label>
                    <span className="text-sm font-mono text-accent-cyan">{settings.confidence_threshold}%</span>
                  </div>
                  <input
                    type="range" min="50" max="99"
                    value={settings.confidence_threshold}
                    onChange={(e) => setSettings((s) => ({ ...s, confidence_threshold: e.target.value }))}
                    className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-cyan"
                  />
                  <p className="mt-2 text-xs text-text-muted">Deteksi di bawah persentase ini akan dibuang oleh filter.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-text-secondary">
                      Waktu Toleransi Parkir Liar (Detik)
                    </label>
                    <span className="text-sm font-mono text-accent-red">{settings.parking_duration_threshold}s</span>
                  </div>
                  <input
                    type="range" min="60" max="600" step="30"
                    value={settings.parking_duration_threshold}
                    onChange={(e) => setSettings((s) => ({ ...s, parking_duration_threshold: e.target.value }))}
                    className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-red"
                  />
                  <p className="mt-2 text-xs text-text-muted">Waktu maksimal kendaraan boleh berhenti di zona larangan.</p>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-lg font-heading font-bold text-white mb-4">Model Aktif</h3>
                <div className="flex items-center gap-4 p-4 rounded-lg border border-accent-blue/20 bg-accent-blue/5">
                  <Settings2 className="h-8 w-8 text-accent-blue" />
                  <div className="flex-1">
                    <p className="font-semibold text-white">{settings.ai_model_version}</p>
                    <p className="text-sm text-text-muted">Indonesian License Plates Custom — EasyOCR ANPR aktif</p>
                  </div>
                  <span className="text-xs rounded-full bg-accent-green/10 border border-accent-green/20 px-2.5 py-1 text-accent-green font-semibold">
                    ✓ Aktif
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-white font-medium">Integrasi Telegram Bot</h3>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${telegramStatus?.configured ? "bg-accent-green" : "bg-accent-red"}`} />
                  <span className="text-sm text-text-secondary">
                    {telegramStatus?.configured
                      ? `Terhubung${telegramStatus.bot ? ` · @${telegramStatus.bot}` : ""}`
                      : "Tidak dikonfigurasi"}
                  </span>
                </div>
                {!telegramStatus?.configured && (
                  <p className="text-xs text-text-muted">
                    Tambahkan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di .env untuk notifikasi pelanggaran.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: KAMERA ── */}
          {activeTab === "kamera" && (
            <div className="space-y-6 max-w-2xl">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Pengaturan Kamera</h3>
              <p className="text-sm text-text-muted mb-4">
                URL stream tiap kamera. Gunakan URL YouTube live, RTSP, atau HLS.
              </p>
              {cameras.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm border border-border rounded-lg border-dashed animate-pulse">
                  Memuat data kamera...
                </div>
              ) : (
                <div className="space-y-4">
                  {cameras.map((cam) => (
                    <div key={cam.id} className="p-4 rounded-lg border border-border bg-bg-tertiary/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-white">{cam.name}</span>
                        <span className="text-xs text-text-muted">{cam.location}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          defaultValue={cam.stream_url || ""}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="flex-1 rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                          onBlur={(e) => {
                            if (e.target.value !== cam.stream_url) {
                              updateStreamUrl(cam.id, e.target.value);
                            }
                          }}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", cam.status === "ACTIVE" ? "bg-accent-green" : "bg-accent-red")} />
                        <span className="text-xs text-text-muted">{cam.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: USERS ── */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-bold text-white">Manajemen Pengguna</h3>
                <button
                  onClick={() => setShowNewUserForm((v) => !v)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-accent-blue text-white hover:bg-blue-500 transition-colors"
                >
                  + Tambah Pengguna
                </button>
              </div>

              {showNewUserForm && (
                <div className="p-4 rounded-lg border border-accent-blue/20 bg-accent-blue/5 space-y-3">
                  <h4 className="text-sm font-semibold text-accent-blue">Pengguna Baru</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      placeholder="Nama lengkap"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, name: e.target.value }))}
                      className="rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                    />
                    <input
                      placeholder="Email"
                      type="email"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
                      className="rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                    />
                  </div>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                  >
                    <option value="OFFICER">OFFICER</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <p className="text-xs text-text-muted">
                    * Pengguna baru perlu diatur password via Supabase Auth.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-tertiary text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Peran</th>
                      <th className="px-4 py-3 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-text-muted text-sm">
                          Memuat pengguna...
                        </td>
                      </tr>
                    ) : users.map((user) => (
                      <tr key={user.id} className="hover:bg-bg-tertiary/30">
                        <td className="px-4 py-3 font-medium text-white">{user.name}</td>
                        <td className="px-4 py-3 text-text-muted">{user.email}</td>
                        <td className="px-4 py-3">
                          {editingUser?.id === user.id ? (
                            <select
                              value={editingUser.role}
                              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                              className="rounded border border-border bg-bg-primary px-2 py-1 text-xs text-white"
                            >
                              <option value="OFFICER">OFFICER</option>
                              <option value="VIEWER">VIEWER</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "inline-flex rounded-full px-2 py-1 text-xs font-semibold border",
                              user.role === "ADMIN"
                                ? "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                                : user.role === "OFFICER"
                                ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                                : "bg-bg-tertiary text-text-muted border-border"
                            )}>{user.role}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingUser?.id === user.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleUpdateUser(user.id, editingUser.role)}
                                className="text-xs text-accent-green hover:underline"
                              >Simpan</button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className="text-xs text-text-muted hover:underline"
                              >Batal</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingUser({ ...user })}
                              className="text-text-muted hover:text-white text-xs transition-colors"
                            >Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: E-TLE ── */}
          {activeTab === "etle" && (
            <div className="space-y-6 max-w-2xl">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Konfigurasi Endpoint E-TLE</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">API Endpoint URL</label>
                  <input
                    type="text"
                    value={settings.etle_endpoint}
                    onChange={(e) => setSettings((s) => ({ ...s, etle_endpoint: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">API Key (Secret)</label>
                  <input
                    type="password"
                    value={settings.etle_api_key}
                    onChange={(e) => setSettings((s) => ({ ...s, etle_api_key: e.target.value }))}
                    placeholder="Kosongkan jika belum tersedia"
                    className="w-full rounded-lg border border-border bg-bg-primary py-2 px-3 text-sm text-white focus:border-accent-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleTestEtle}
                  disabled={etleTest.testing}
                  className="inline-flex items-center gap-2 rounded-lg border border-accent-blue/50 bg-accent-blue/10 px-4 py-2 text-sm font-semibold text-accent-blue hover:bg-accent-blue hover:text-white transition-all disabled:opacity-50"
                >
                  {etleTest.testing
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <Wifi className="h-4 w-4" />}
                  Test Koneksi
                </button>
                {etleTest.status && !etleTest.testing && (
                  <div className="flex items-center gap-2">
                    {etleTest.status === "REACHABLE"
                      ? <Wifi className="h-4 w-4 text-accent-green" />
                      : <WifiOff className="h-4 w-4 text-accent-red" />}
                    <span className={cn("text-sm font-semibold", etleStatusColors[etleTest.status] ?? "text-text-muted")}>
                      {etleTest.status}
                    </span>
                    {etleTest.latencyMs !== undefined && etleTest.latencyMs > 0 && (
                      <span className="text-xs text-text-muted">{etleTest.latencyMs}ms</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: PREFERENCES ── */}
          {activeTab === "preferences" && (
            <div className="space-y-8 max-w-2xl">
              <h3 className="text-lg font-heading font-bold text-white mb-4">Preferensi Tampilan & Sistem</h3>

              {/* Theme */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-bg-tertiary/50">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? <Moon className="h-5 w-5 text-accent-blue" /> : <Sun className="h-5 w-5 text-accent-amber" />}
                  <div>
                    <p className="font-medium text-white">Tema Antarmuka</p>
                    <p className="text-xs text-text-muted">Mode gelap direkomendasikan untuk monitoring malam</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {["dark", "light"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                        theme === t ? "bg-accent-blue text-white" : "border border-border text-text-muted hover:text-white"
                      )}
                    >
                      {t === "dark" ? "Gelap" : "Terang"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-bg-tertiary/50">
                <div className="flex items-center gap-3">
                  <Bell className={cn("h-5 w-5", notifEnabled ? "text-accent-cyan" : "text-text-muted")} />
                  <div>
                    <p className="font-medium text-white">Notifikasi Browser</p>
                    <p className="text-xs text-text-muted">Pop-up notifikasi saat pelanggaran baru terdeteksi</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotifEnabled((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    notifEnabled ? "bg-accent-cyan" : "bg-bg-primary border border-border"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    notifEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-bg-tertiary/50">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-accent-green" />
                  <div>
                    <p className="font-medium text-white">Bahasa Antarmuka</p>
                    <p className="text-xs text-text-muted">Bahasa tampilan dashboard</p>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm text-white focus:border-accent-blue focus:outline-none"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3">
                <p className="text-xs text-accent-amber">
                  💡 Pengaturan preferensi disimpan di browser ini secara lokal.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
