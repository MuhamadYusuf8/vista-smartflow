"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  KeyRound,
  Radio,
  Monitor,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// NOTE ON METADATA
// This file starts with "use client" (it needs useState/useActionState),
// and Next.js does not allow a Client Component to export `metadata`.
// If you want a custom <title>/description for this route, add a small
// app/login/layout.tsx (Server Component) next to this file:
//
//   export const metadata = { title: "Masuk — VISTA SmartFlow AI" };
//   export default function LoginLayout({ children }: { children: React.ReactNode }) {
//     return children;
//   }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Typography: three roles, paired deliberately for a command-console feel.
// Space Grotesk carries the VISTA wordmark, JetBrains Mono renders anything
// that reads like live system data (clock, status, version tag), and Inter
// stays quiet in the background for UI copy and form fields.
// ---------------------------------------------------------------------------
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

// ---------------------------------------------------------------------------
// Roles — mirrors the NextAuth role split (Admin / Officer / Viewer).
// ---------------------------------------------------------------------------
type Role = "admin" | "officer" | "viewer";

type LoginState = { error: string | null };

const initialState: LoginState = { error: null };

const ROLE_CONFIG: Record<
  Role,
  {
    label: string;
    icon: LucideIcon;
    description: string;
    redirectPath: string;
    accent: string;
  }
> = {
  admin: {
    label: "Admin",
    icon: KeyRound,
    description: "Kendali penuh sistem & konfigurasi",
    redirectPath: "/",
    accent: "from-indigo-500 to-blue-500",
  },
  officer: {
    label: "Officer",
    icon: Radio,
    description: "Operasional lapangan & respons insiden",
    redirectPath: "/",
    accent: "from-blue-500 to-cyan-400",
  },
  viewer: {
    label: "Viewer",
    icon: Monitor,
    description: "Pemantauan data & laporan saja",
    redirectPath: "/",
    accent: "from-cyan-400 to-teal-400",
  },
};

// ---------------------------------------------------------------------------
// Scoped styles for this screen. Rendered via a plain <style> tag so this
// component has zero dependency on your project's globals.css — copy this
// one file anywhere and it will look right out of the box.
// ---------------------------------------------------------------------------
const LOGIN_STYLES = `
  .vista-font-display { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; }
  .vista-font-mono { font-family: var(--font-mono), ui-monospace, monospace; }
  .vista-font-body { font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif; }

  .vista-grid {
    background-image:
      linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
    background-size: 42px 42px;
  }

  @keyframes vista-scan-sweep {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  .vista-scan-line { animation: vista-scan-sweep 7s linear infinite; }

  @keyframes vista-node-pulse {
    0%, 100% { opacity: 0.35; r: 3.2; }
    50% { opacity: 1; r: 4.4; }
  }
  .vista-node { animation: vista-node-pulse 3.4s ease-in-out infinite; transform-origin: center; }

  @keyframes vista-lock-on {
    0% { opacity: 0; transform: scale(1.6); }
    100% { opacity: 1; transform: scale(1); }
  }
  .vista-bracket { animation: vista-lock-on 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }

  @keyframes vista-shimmer {
    0% { transform: translateX(-120%) skewX(-12deg); }
    100% { transform: translateX(220%) skewX(-12deg); }
  }
  .vista-shimmer::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.35) 50%, transparent 80%);
    transform: translateX(-120%) skewX(-12deg);
  }
  .group:hover .vista-shimmer::after { animation: vista-shimmer 1.1s ease; }

  @keyframes vista-status-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55); }
    50% { box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); }
  }
  .vista-status-dot { animation: vista-status-pulse 2s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .vista-scan-line, .vista-node, .vista-bracket, .vista-status-dot,
    .group:hover .vista-shimmer::after { animation: none !important; }
  }
`;

// ---------------------------------------------------------------------------
// Live clock — client-only, so we render a placeholder until mounted to
// avoid a hydration mismatch between server and browser time.
// ---------------------------------------------------------------------------
function useLiveClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const formatted = new Date().toLocaleTimeString("id-ID", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTime(`${formatted} WIB`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

// ---------------------------------------------------------------------------
// Ambient background: a stylised road network (nodes = monitored
// intersections, curves = ring roads) with slow-moving pulses standing in
// for live traffic / data flow. Purely decorative, aria-hidden.
// ---------------------------------------------------------------------------
function NetworkBackground() {
  const xs = [120, 320, 520, 720, 900];
  const ys = [90, 240, 400, 550, 650];
  const activeNodes = new Set([
    "120-240",
    "520-90",
    "720-400",
    "320-550",
    "900-240",
    "520-650",
    "120-90",
  ]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="vista-grid absolute inset-0" />
      <svg
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-70"
        aria-hidden="true"
      >
        <g stroke="#1c2b45" strokeWidth="1">
          {xs.map((x) => (
            <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={700} />
          ))}
          {ys.map((y) => (
            <line key={`h-${y}`} x1={0} y1={y} x2={1000} y2={y} />
          ))}
        </g>

        <g fill="none" stroke="#22d3ee" strokeOpacity="0.18" strokeWidth="1.5">
          <path d="M40,650 C250,250 650,150 960,480" />
          <path d="M200,650 C350,420 650,420 850,200" />
        </g>

        <g>
          {xs.flatMap((x) =>
            ys.map((y) => {
              const key = `${x}-${y}`;
              const active = activeNodes.has(key);
              return (
                <circle
                  key={key}
                  cx={x}
                  cy={y}
                  r={active ? 3.2 : 2}
                  fill={active ? "#22d3ee" : "#33445f"}
                  className={active ? "vista-node" : undefined}
                  style={
                    active
                      ? { animationDelay: `${((x + y) % 5) * 0.4}s` }
                      : undefined
                  }
                />
              );
            }),
          )}
        </g>

        <g fill="#67e8f9">
          <circle r="3">
            <animateMotion
              path="M120,0 L120,700"
              dur="6s"
              begin="0s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3">
            <animateMotion
              path="M0,240 L1000,240"
              dur="8s"
              begin="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="3">
            <animateMotion
              path="M720,700 L720,0"
              dur="7s"
              begin="2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="2.5">
            <animateMotion
              path="M40,650 C250,250 650,150 960,480"
              dur="10s"
              begin="0.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="2.5">
            <animateMotion
              path="M850,200 C650,420 350,420 200,650"
              dur="9s"
              begin="3s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>

      <div className="vista-scan-line pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-cyan-400/10 via-cyan-400/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,7,13,0.75)_78%)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (Client Component) — this file is the entire route.
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("officer");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const clock = useLiveClock();
  const activeRole = ROLE_CONFIG[selectedRole];

  const [state, formAction, isPending] = useActionState(
    async (_prevState: LoginState, formData: FormData): Promise<LoginState> => {
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      const role = (String(formData.get("role") ?? selectedRole) as Role) || selectedRole;

      if (!email || !password) {
        return { error: "Email dan kata sandi wajib diisi." };
      }

      try {
        // NOTE: "credentials" should match the provider id configured in
        // your NextAuth options (app/api/auth/[...nextauth]/route.ts).
        const result = await signIn("credentials", {
          email,
          password,
          role,
          redirect: false,
        });

        if (!result || result.error) {
          return {
            error:
              `Login gagal. Pastikan email, kata sandi, dan role sudah benar. ` +
              `Akun "${email}" mungkin bukan ${ROLE_CONFIG[role].label}.`,
          };
        }

        window.location.href = ROLE_CONFIG[role].redirectPath;
        return { error: null };
      } catch {
        return {
          error:
            "Tidak dapat terhubung ke server autentikasi. Coba lagi sebentar lagi.",
        };
      }
    },
    initialState,
  );

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100 ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <style>{LOGIN_STYLES}</style>

      <NetworkBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* HUD status bar */}
        <header className="flex items-center justify-between border-b border-white/5 bg-black/30 px-4 py-2.5 backdrop-blur-sm sm:px-8">
          <div className="vista-font-mono flex items-center gap-2 text-[11px] tracking-wider text-emerald-400/90">
            <span className="vista-status-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            SISTEM OPERASIONAL
          </div>
          <div className="vista-font-mono hidden items-center gap-4 text-[11px] text-slate-400 sm:flex">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> TLS 1.3 · Terenkripsi
            </span>
            <span>{clock ?? "--:--:-- WIB"}</span>
          </div>
        </header>

        {/* Login card */}
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="relative w-full max-w-md">
            <span
              className="vista-bracket absolute -left-2 -top-2 h-7 w-7 border-l-2 border-t-2 border-cyan-400/70"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="vista-bracket absolute -right-2 -top-2 h-7 w-7 border-r-2 border-t-2 border-cyan-400/70"
              style={{ animationDelay: "90ms" }}
            />
            <span
              className="vista-bracket absolute -bottom-2 -left-2 h-7 w-7 border-b-2 border-l-2 border-cyan-400/70"
              style={{ animationDelay: "160ms" }}
            />
            <span
              className="vista-bracket absolute -bottom-2 -right-2 h-7 w-7 border-b-2 border-r-2 border-cyan-400/70"
              style={{ animationDelay: "230ms" }}
            />

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_0_60px_-15px_rgba(34,211,238,0.25)] backdrop-blur-2xl sm:p-10">
              {/* Logo */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <span className="absolute inset-0 -m-2 animate-pulse rounded-2xl bg-blue-500/20 blur-md" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/30 bg-gradient-to-br from-blue-500/20 to-cyan-400/10">
                    <ShieldCheck className="h-7 w-7 text-blue-400" />
                  </div>
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#05070d]" />
                </div>
                <h1 className="vista-font-display text-2xl font-bold tracking-[0.15em] text-white">
                  VISTA
                </h1>
                <p className="vista-font-mono text-xs tracking-[0.2em] text-cyan-400/80">
                  SMARTFLOW AI
                </p>
              </div>

              {/* Role selector */}
              <div className="mt-7 grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/30 p-1.5">
                {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const Icon = config.icon;
                  const active = role === selectedRole;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      aria-pressed={active}
                      className={`vista-font-body flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        active
                          ? `bg-gradient-to-b ${config.accent} text-white shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]`
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              <p className="vista-font-body mt-2 text-center text-[11px] text-slate-500">
                {activeRole.description}
              </p>

              {/* Form */}
              <form action={formAction} className="mt-6 space-y-4">
                <input type="hidden" name="role" value={selectedRole} readOnly />

                <div>
                  <label
                    htmlFor="email"
                    className="vista-font-body mb-1.5 block text-xs font-medium text-slate-300"
                  >
                    Email Instansi
                  </label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="nama@dishub.jakarta.go.id"
                      className="vista-font-body w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="vista-font-body block text-xs font-medium text-slate-300"
                    >
                      Kata Sandi
                    </label>
                    <Link
                      href="/forgot-password"
                      className="vista-font-body text-[11px] text-cyan-400/80 hover:text-cyan-300"
                    >
                      Lupa kata sandi?
                    </Link>
                  </div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="vista-font-body w-full rounded-lg border border-white/10 bg-black/30 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      aria-label={
                        showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="vista-font-body flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-black/30 accent-cyan-400"
                    />
                    Ingat saya di perangkat ini
                  </label>
                </div>

                {state.error ? (
                  <div
                    role="alert"
                    className="vista-font-body flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {state.error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isPending}
                  className={`group relative w-full overflow-hidden rounded-lg bg-gradient-to-r ${activeRole.accent} py-3 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <span className="vista-shimmer absolute inset-0" />
                  <span className="vista-font-body relative z-10 flex items-center justify-center gap-2">
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Memverifikasi...
                      </>
                    ) : (
                      `Masuk sebagai ${activeRole.label}`
                    )}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mx-auto w-full max-w-md px-4 pb-8 text-center">
          <p className="vista-font-body text-[11px] leading-relaxed text-slate-500">
            Dinas Perhubungan Provinsi DKI Jakarta — Sistem Rahasia &amp; Terbatas
          </p>
          <div className="vista-font-mono mt-1 flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <span>© 2026 VISTA Team</span>
            <span aria-hidden="true">·</span>
            <span>VISTA-CORE v2.6.1 · ATCS-JKT</span>
          </div>
        </footer>
      </div>
    </div>
  );
}