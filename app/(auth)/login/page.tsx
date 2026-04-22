"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Email atau kata sandi tidak valid");
      } else {
        router.push("/");
        router.refresh(); // Refresh to update session status globally
      }
    } catch (err) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-bg-primary">
      {/* Background Animated CCTV Grid */}
      <div className="absolute inset-0 z-0 opacity-20 transition-opacity duration-1000">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(10,14,26,0.9)_2px,transparent_2px),linear-gradient(90deg,rgba(10,14,26,0.9)_2px,transparent_2px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)]"></div>
        {/* Animated Scanline */}
        <div className="animate-scan absolute inset-0 bg-gradient-to-b from-transparent via-accent-blue/10 to-transparent"></div>
      </div>

      <div className="z-10 w-full max-w-md px-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-secondary/40 p-8 shadow-2xl backdrop-blur-xl transition-all">
          
          {/* Logo / Header */}
          <div className="mb-8 flex flex-col items-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-blue/10 shadow-[var(--glow-blue)]">
              <Shield className="h-8 w-8 text-accent-blue" />
              <div className="absolute top-0 right-0 h-3 w-3 -translate-y-1 translate-x-1 rounded-full bg-accent-red animate-pulse-dot shadow-[var(--glow-red)]"></div>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-widest text-white">VISTA</h1>
            <p className="mt-1 text-sm font-medium text-accent-blue">SmartFlow AI</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-accent-red/10 p-3 text-center text-sm text-accent-red border border-accent-red/20">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="relative group">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full rounded-lg border border-border bg-bg-primary/50 px-4 pt-6 pb-2 text-white placeholder-transparent transition-all focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="Email"
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-4 top-2 text-xs text-text-muted transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-focus:text-accent-blue"
                >
                  Email Officer
                </label>
              </div>

              <div className="relative group">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peer w-full rounded-lg border border-border bg-bg-primary/50 px-4 pt-6 pb-2 text-white placeholder-transparent transition-all focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                  placeholder="Password"
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-4 top-2 text-xs text-text-muted transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-focus:text-accent-blue"
                >
                  Kata Sandi
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full overflow-hidden rounded-lg bg-accent-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:bg-blue-400 hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengautentikasi...
                </span>
              ) : (
                "Login sebagai Officer"
              )}
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-text-muted">
          <p>Jakarta Transportation Agency — Confidential System</p>
          <p className="mt-1 opacity-50">&copy; {new Date().getFullYear()} VISTA Team. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
