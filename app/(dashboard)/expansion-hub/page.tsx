"use client";
import { useState, useEffect } from "react";
import { Globe, TrendingUp, Building2, MapPin, DollarSign, Star, ArrowRight, Zap, CheckCircle2 } from "lucide-react";

const ID_CITIES = [
  { name: "Jakarta", status: "LIVE", phase: "Pilot", cams: 5, pop: 10.6, color: "accent-green", coords: { x: "48%", y: "62%" } },
  { name: "Surabaya", status: "READY", phase: "Q3 2026", cams: 120, pop: 2.9, color: "accent-blue", coords: { x: "58%", y: "65%" } },
  { name: "Bandung", status: "READY", phase: "Q4 2026", cams: 95, pop: 2.4, color: "accent-blue", coords: { x: "46%", y: "63%" } },
  { name: "Medan", status: "INTEREST", phase: "Q1 2027", cams: 80, pop: 2.2, color: "accent-amber", coords: { x: "28%", y: "38%" } },
  { name: "Makassar", status: "INTEREST", phase: "Q2 2027", cams: 65, pop: 1.4, color: "accent-amber", coords: { x: "64%", y: "62%" } },
  { name: "Semarang", status: "INTEREST", phase: "Q2 2027", cams: 70, pop: 1.6, color: "accent-amber", coords: { x: "52%", y: "63%" } },
  { name: "Palembang", status: "PIPELINE", phase: "Q3 2027", cams: 55, pop: 1.7, color: "text-muted", coords: { x: "38%", y: "55%" } },
  { name: "Balikpapan", status: "PIPELINE", phase: "Q4 2027", cams: 40, pop: 0.9, color: "text-muted", coords: { x: "63%", y: "52%" } },
];

const ASEAN_CITIES = [
  { name: "Kuala Lumpur", country: "🇲🇾 Malaysia", phase: "Bulan 24", arr: "Q1 2028", potential: "RM 120M" },
  { name: "Manila", country: "🇵🇭 Filipina", phase: "Bulan 28", arr: "Q3 2028", potential: "₱ 2.1B" },
  { name: "Ho Chi Minh City", country: "🇻🇳 Vietnam", phase: "Bulan 30", arr: "Q4 2028", potential: "₫ 85B" },
  { name: "Bangkok", country: "🇹🇭 Thailand", phase: "Bulan 34", arr: "Q2 2029", potential: "฿ 450M" },
  { name: "Phnom Penh", country: "🇰🇭 Kamboja", phase: "Bulan 36", arr: "Q3 2029", potential: "$12M USD" },
];

const TIERS = [
  { name: "Starter City", price: 2_500_000_000, cams: 20, features: ["Deteksi AI dasar", "Dashboard monitoring", "Export laporan CSV", "Support 5x8"], color: "border-border" },
  { name: "Smart City", price: 8_000_000_000, cams: 100, features: ["Semua fitur Starter", "ANPR Nasional DB", "Command Center", "Carbon Tracker", "Telegram notifikasi", "Support 24/7"], color: "border-accent-blue/50", popular: true },
  { name: "Metropolitan", price: 25_000_000_000, cams: 247, features: ["Semua fitur Smart City", "Adaptive Traffic Light", "Digital Twin 3D", "AI Court-Ready Evidence", "Dedicated engineer", "Custom integration"], color: "border-accent-amber/50" },
];

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  return `Rp ${(n / 1_000_000).toFixed(0)}Jt`;
}

function AnimCounter({ to, duration = 1500, prefix = "", suffix = "" }: { to: number; duration?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const s = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - s) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to, duration]);
  return <span>{prefix}{v.toLocaleString("id-ID")}{suffix}</span>;
}

export default function ExpansionHubPage() {
  const [cities, setCities] = useState(3);
  const [tier, setTier] = useState(1);
  const [activeTab, setActiveTab] = useState<"indonesia" | "asean">("indonesia");

  const tierPrices = [2_500_000_000, 8_000_000_000, 25_000_000_000];
  const annualRevenue = cities * tierPrices[tier] * 0.2; // 20% annual license
  const totalArr = cities * tierPrices[tier];
  const totalCams = ID_CITIES.reduce((a, c) => a + (c.status !== "PIPELINE" ? c.cams : 0), 0);

  const statusColor: Record<string, string> = {
    LIVE: "bg-accent-green text-bg-primary",
    READY: "bg-accent-blue text-white",
    INTEREST: "bg-accent-amber text-bg-primary",
    PIPELINE: "bg-bg-tertiary text-text-muted border border-border",
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl border border-accent-blue/20 overflow-hidden bg-gradient-to-br from-[#0a1628] via-bg-secondary to-[#0d1a2e] p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.08),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
              <Globe className="h-4 w-4 text-accent-blue" />
            </div>
            <span className="text-sm font-semibold text-accent-blue">VISTA SmartFlow AI</span>
            <span className="text-text-muted">/</span>
            <span className="text-sm text-text-muted">Rencana Ekspansi</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-white mb-3 leading-tight">
            Dari Jakarta,<br />
            <span className="bg-gradient-to-r from-accent-blue via-purple-400 to-accent-cyan bg-clip-text text-transparent">
              Menuju Seluruh Indonesia &amp; ASEAN
            </span>
          </h1>
          <p className="text-text-secondary max-w-2xl mb-8 text-base leading-relaxed">
            VISTA SmartFlow AI dirancang sejak awal sebagai platform SaaS yang dapat direplikasi. Setiap kota di Indonesia — dan negara di Asia Tenggara — dapat mengadopsi sistem ini dalam hitungan minggu.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Kota Target Indonesia", val: ID_CITIES.length, suffix: " kota" },
              { label: "Kamera Potensi", val: totalCams, suffix: "+" },
              { label: "Potensi Market ASEAN", val: 2.4, suffix: " T IDR", prefix: "Rp " },
              { label: "Negara Target ASEAN", val: ASEAN_CITIES.length, suffix: " negara" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4">
                <p className="text-xs text-text-muted mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white font-heading">
                  <AnimCounter to={s.val} prefix={s.prefix ?? ""} suffix={s.suffix} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["indonesia", "asean"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t ? "bg-accent-blue text-white" : "border border-border text-text-muted hover:text-white"}`}>
            {t === "indonesia" ? "🇮🇩 Ekspansi Indonesia" : "🌏 Ekspansi ASEAN"}
          </button>
        ))}
      </div>

      {activeTab === "indonesia" && (
        <div className="space-y-6">
          {/* City Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ID_CITIES.map((city) => (
              <div key={city.name} className={`rounded-xl border bg-bg-secondary p-5 transition-all hover:border-accent-blue/40 ${city.status === "LIVE" ? "border-accent-green/40 bg-accent-green/5" : city.status === "READY" ? "border-accent-blue/30 bg-accent-blue/5" : "border-border"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-heading font-bold text-white">{city.name}</h3>
                    <p className="text-xs text-text-muted">{city.pop}M penduduk</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[city.status]}`}>{city.status}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Target kamera</span>
                    <span className="font-mono font-bold text-white">{city.cams} unit</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Timeline</span>
                    <span className="font-semibold text-accent-cyan">{city.phase}</span>
                  </div>
                  <div className="h-1 w-full bg-bg-tertiary rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full ${city.status === "LIVE" ? "bg-accent-green w-full" : city.status === "READY" ? "bg-accent-blue w-3/4" : city.status === "INTEREST" ? "bg-accent-amber w-2/5" : "w-1/6 bg-bg-primary border border-border"}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap gap-3">
            {[
              { s: "LIVE", desc: "Sudah berjalan" },
              { s: "READY", desc: "Siap deploy — menunggu MoU" },
              { s: "INTEREST", desc: "Dishub sudah menunjukkan minat" },
              { s: "PIPELINE", desc: "Target pengembangan jangka panjang" },
            ].map((item) => (
              <span key={item.s} className="flex items-center gap-2 text-xs text-text-muted">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[item.s]}`}>{item.s}</span>
                {item.desc}
              </span>
            ))}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-bg-secondary p-6">
            <h3 className="font-heading font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-blue" />
              Timeline Ekspansi Indonesia (Bulan 1–36)
            </h3>
            <div className="relative">
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-gradient-to-r from-accent-green via-accent-blue to-accent-amber" />
              <div className="grid grid-cols-4 gap-4 relative">
                {[
                  { period: "Bulan 1–3", title: "Jakarta Pilot", cities: "Jl. Sudirman (5 kamera)", color: "bg-accent-green text-bg-primary" },
                  { period: "Bulan 4–12", title: "Jakarta Full", cities: "247 kamera seluruh DKI", color: "bg-accent-blue text-white" },
                  { period: "Bulan 13–24", title: "Jawa Ekspansi", cities: "Surabaya + Bandung + Semarang", color: "bg-purple-500 text-white" },
                  { period: "Bulan 25–36", title: "Nasional", cities: "Medan + Makassar + 5 kota lain", color: "bg-accent-amber text-bg-primary" },
                ].map((step, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold mb-3 z-10 ${step.color}`}>{i + 1}</div>
                    <p className="text-xs font-bold text-white">{step.title}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{step.period}</p>
                    <p className="text-[10px] text-accent-cyan mt-1">{step.cities}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "asean" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ASEAN_CITIES.map((city, i) => (
              <div key={city.name} className="rounded-xl border border-border bg-bg-secondary p-5 hover:border-accent-blue/40 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-heading font-bold text-white">{city.name}</h3>
                    <p className="text-sm text-text-muted">{city.country}</p>
                  </div>
                  <span className="text-xs font-bold text-accent-amber border border-accent-amber/30 bg-accent-amber/10 px-2 py-0.5 rounded-full">{city.phase}</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-text-muted">Target ARR</span><span className="font-bold text-accent-green">{city.potential}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Target Entry</span><span className="font-semibold text-accent-cyan">{city.arr}</span></div>
                  <div className="h-1 w-full bg-bg-tertiary rounded-full overflow-hidden mt-2">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${(5 - i) * 18}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ASEAN Strategy */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">
            <h3 className="font-heading font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-400" />Strategi Masuk Pasar ASEAN
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Leverage Jakarta", desc: "Gunakan case study Jakarta sebagai referensi. Kota dengan 10M+ penduduk dan sistem ANPR working = credibility instant." },
                { step: "2", title: "Kemitraan Lokal", desc: "Cari system integrator lokal di tiap negara. Mereka handle regulasi & hubungan pemerintah, VISTA sediakan platform." },
                { step: "3", title: "White-Label SaaS", desc: "Platform bisa di-white-label: 'Powered by VISTA' → klien menjual ke pemerintah lokal dengan brand mereka sendiri." },
              ].map((s) => (
                <div key={s.step} className="rounded-lg bg-bg-secondary border border-border p-4">
                  <div className="h-8 w-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-sm mb-3">{s.step}</div>
                  <p className="font-semibold text-white text-sm mb-1">{s.title}</p>
                  <p className="text-xs text-text-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SaaS Revenue Simulator */}
      <div className="rounded-xl border border-accent-green/20 bg-gradient-to-br from-accent-green/5 via-bg-secondary to-accent-blue/5 p-6">
        <h3 className="font-heading text-xl font-bold text-white mb-2 flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-accent-green" />SaaS Revenue Simulator
        </h3>
        <p className="text-sm text-text-muted mb-6">Proyeksikan pendapatan berdasarkan jumlah kota dan paket lisensi</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* Slider: Cities */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-text-secondary">Jumlah Kota Klien</label>
                <span className="text-lg font-bold text-accent-cyan">{cities} kota</span>
              </div>
              <input type="range" min={1} max={20} value={cities} onChange={(e) => setCities(+e.target.value)}
                className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-cyan" />
              <div className="flex justify-between text-xs text-text-muted mt-1"><span>1 kota</span><span>20 kota</span></div>
            </div>

            {/* Tier Selector */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-3">Paket Lisensi</label>
              <div className="space-y-2">
                {["Starter (20 kamera)", "Smart City (100 kamera)", "Metropolitan (247 kamera)"].map((t, i) => (
                  <button key={i} onClick={() => setTier(i)}
                    className={`w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-all ${tier === i ? "border-accent-blue/50 bg-accent-blue/10 text-white" : "border-border text-text-muted hover:text-white"}`}>
                    <span>{t}</span>
                    <span className="font-mono font-bold text-accent-green">{formatRp(tierPrices[i])}/kota</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue Output */}
          <div className="space-y-4">
            <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 p-6">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Contract Value (TCV)</p>
              <p className="text-4xl font-bold text-accent-green font-heading">{formatRp(totalArr)}</p>
              <p className="text-sm text-text-muted mt-1">{cities} kota × {formatRp(tierPrices[tier])}</p>
            </div>
            <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-4">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Annual Recurring Revenue (ARR)</p>
              <p className="text-2xl font-bold text-accent-blue font-heading">{formatRp(annualRevenue)}</p>
              <p className="text-xs text-text-muted mt-0.5">20% annual license fee</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <p className="text-xs text-text-muted mb-1">Total Kamera</p>
                <p className="text-xl font-bold text-white">{(cities * [20, 100, 247][tier]).toLocaleString("id-ID")}</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <p className="text-xs text-text-muted mb-1">Potensi PAD Klien</p>
                <p className="text-xl font-bold text-accent-amber">{formatRp(cities * [20, 100, 247][tier] * 2000 * 30 * 250_000 * 0.3 / 1000)}</p>
                <p className="text-[10px] text-text-muted">/bulan (estimasi)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Tiers */}
      <div>
        <h3 className="font-heading text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Star className="h-5 w-5 text-accent-amber" />Paket Lisensi VISTA SmartFlow AI
        </h3>
        <p className="text-sm text-text-muted mb-6">Model SaaS tahunan untuk pemerintah daerah seluruh Indonesia</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div key={t.name} className={`rounded-xl border-2 bg-bg-secondary p-6 relative transition-all hover:scale-[1.01] ${t.color}`}>
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-accent-blue text-white text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</span>
                </div>
              )}
              <h4 className="font-heading font-bold text-white text-lg mb-1">{t.name}</h4>
              <p className="text-xs text-text-muted mb-4">{t.cams} kamera · 1 kota</p>
              <p className="text-3xl font-bold text-white font-heading mb-1">{formatRp(t.price)}</p>
              <p className="text-xs text-text-muted mb-5">implementasi + 1 tahun lisensi</p>
              <div className="space-y-2">
                {t.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-accent-green flex-shrink-0" />
                    <span className="text-text-secondary">{f}</span>
                  </div>
                ))}
              </div>
              <button className={`mt-6 w-full rounded-lg py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${t.popular ? "bg-accent-blue text-white hover:bg-blue-500" : "border border-border text-text-secondary hover:text-white hover:bg-bg-tertiary"}`}>
                Pilih Paket <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl border border-accent-blue/20 bg-gradient-to-r from-accent-blue/15 via-purple-500/10 to-accent-green/10 p-8 text-center">
        <Zap className="h-12 w-12 text-accent-blue mx-auto mb-4" />
        <h3 className="font-heading text-2xl font-bold text-white mb-2">Jadilah Kota Pertama di Luar Jakarta</h3>
        <p className="text-text-muted max-w-lg mx-auto mb-6">
          Kami menawarkan <strong className="text-white">pilot project 3 bulan GRATIS</strong> untuk kota kedua yang bergabung.
          Dishub Jakarta sebagai referensi, teknologi terbukti, ROI terukur.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="inline-flex items-center gap-2 rounded-xl bg-accent-blue px-8 py-3 text-sm font-bold text-white hover:bg-blue-500 transition-all">
            <Building2 className="h-4 w-4" />MoU Pilot Project
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-secondary px-8 py-3 text-sm font-bold text-text-secondary hover:text-white transition-all">
            <MapPin className="h-4 w-4" />Daftar Minat Kota
          </button>
        </div>
        <p className="text-xs text-text-muted mt-4">
          Sudah tertarik: Bandung · Surabaya · Semarang · Makassar
        </p>
      </div>
    </div>
  );
}
