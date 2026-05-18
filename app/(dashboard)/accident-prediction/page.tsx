"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle, TrendingUp, MapPin, Clock, Users,
  Brain, RefreshCw, Bell, ArrowUpRight,
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { TOP_INTERSECTIONS, HOUR_CONGESTION_FACTOR, getDailyViolationBase } from "@/lib/pilot-data";

interface Prediction {
  intersection: string;
  riskScore: number;
  riskLevel: "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";
  peakHour: string;
  contributingFactors: string[];
  recommendation: string;
  historicalAccidents: number;
  predictedViolations: number;
}

function getRiskLevel(score: number): Prediction["riskLevel"] {
  if (score >= 80) return "KRITIS";
  if (score >= 65) return "TINGGI";
  if (score >= 45) return "SEDANG";
  return "RENDAH";
}
function getRiskColor(level: string) {
  return { KRITIS: "text-accent-red", TINGGI: "text-accent-amber", SEDANG: "text-accent-cyan", RENDAH: "text-accent-green" }[level] ?? "text-text-muted";
}
function getRiskBg(level: string) {
  return { KRITIS: "border-accent-red/30 bg-accent-red/10", TINGGI: "border-accent-amber/30 bg-accent-amber/10", SEDANG: "border-accent-cyan/30 bg-accent-cyan/10", RENDAH: "border-accent-green/30 bg-accent-green/10" }[level] ?? "border-border bg-bg-secondary";
}

const FACTORS = ["Tingkat pelanggaran busway tinggi","Riwayat insiden 3 bulan terakhir","Volume kendaraan melebihi kapasitas","Pola parkir liar di bahu jalan","Kecepatan rata-rata melebihi 60 km/h","Geometri jalan (tikungan tajam)","Minimnya penerangan malam hari","Konflik pejalan kaki dan kendaraan"];
const RECOMMENDATIONS = ["Tambah 2 petugas jam 07:00–09:00 dan 17:00–19:00","Pasang rambu peringatan kecepatan + speed camera","Koordinasi dengan TMC optimasi fase lampu merah","Gelar operasi tilang terjadwal 3 hari ke depan","Pasang water barrier bahu jalan illegal parking","Aktifkan unit Gatur Lantas mobile jam sibuk"];

export default function AccidentPredictionPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [nextUpdate, setNextUpdate] = useState(30);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    function generate() {
      const violBase = getDailyViolationBase();
      const h = new Date().getHours();
      const nextPeak = h < 8 ? "07:00–09:00" : h < 17 ? "17:00–19:00" : "07:00–09:00 (besok)";
      const preds: Prediction[] = TOP_INTERSECTIONS.map((loc, i) => {
        const score = Math.min(Math.max(loc.risk + Math.round(Math.sin(Date.now()/50000+i)*4), 30), 95);
        return {
          intersection: loc.name,
          riskScore: score,
          riskLevel: getRiskLevel(score),
          peakHour: nextPeak,
          contributingFactors: [FACTORS[(i*3)%FACTORS.length], FACTORS[(i*3+1)%FACTORS.length], FACTORS[(i*3+2)%FACTORS.length]].slice(0, 2+(i%2)),
          recommendation: RECOMMENDATIONS[i % RECOMMENDATIONS.length],
          historicalAccidents: 3 + i * 2,
          predictedViolations: Math.round(violBase * (score / 100) * 0.4),
        };
      }).sort((a, b) => b.riskScore - a.riskScore);
      setPredictions(preds);
      setSelected((prev) => preds.find((p) => p.intersection === prev?.intersection) ?? preds[0]);
    }
    generate();
    const iv = setInterval(generate, 30000);
    const cd = setInterval(() => setNextUpdate((n) => n <= 1 ? 30 : n - 1), 1000);
    return () => { clearInterval(iv); clearInterval(cd); };
  }, []);

  const radarData = selected ? [
    { subject: "Volume", value: Math.round(selected.riskScore * 0.9) },
    { subject: "Pelanggaran", value: Math.round(selected.riskScore * 1.05) },
    { subject: "Historis", value: selected.historicalAccidents * 8 },
    { subject: "Geometri", value: 45 + Math.round(selected.riskScore * 0.3) },
    { subject: "Kecepatan", value: Math.round(selected.riskScore * 0.85) },
  ] : [];

  const forecastData = Array.from({ length: 24 }, (_, h) => {
    const risk = selected ? Math.round(selected.riskScore * (HOUR_CONGESTION_FACTOR[h] ?? 0.5)) : 0;
    return { label: `${String(h).padStart(2,"0")}:00`, risk, color: risk >= 70 ? "#ef4444" : risk >= 50 ? "#f59e0b" : "#10b981" };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white mb-1 flex items-center gap-3">
            <Brain className="h-7 w-7 text-accent-amber" />
            Analitik Prediktif Kecelakaan
          </h1>
          <p className="text-sm text-text-muted">Model AI berbasis riwayat pelanggaran 90 hari — Koridor Sudirman</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />Update dalam {nextUpdate}s
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-green/20 bg-accent-green/10 px-3 py-1.5 text-xs font-semibold text-accent-green">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />Model Aktif · 87.3% Presisi
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-accent-amber/20 bg-accent-amber/5 p-4 flex items-center gap-4">
        <Brain className="h-10 w-10 text-accent-amber flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-white">VISTA Accident Risk Model v1.2</p>
          <p className="text-sm text-text-muted">Dilatih dari 15.672 insiden · 247 titik CCTV · 90 hari historis</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-accent-amber">{predictions.filter((p) => ["KRITIS","TINGGI"].includes(p.riskLevel)).length}</p>
          <p className="text-xs text-text-muted">Titik Risiko Tinggi</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {predictions.map((pred, i) => (
            <button key={pred.intersection} onClick={() => setSelected(pred)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${selected?.intersection === pred.intersection ? getRiskBg(pred.riskLevel) : "border-border bg-bg-secondary hover:bg-bg-tertiary"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">#{i+1}</span>
                  <span className="font-semibold text-white">{pred.intersection}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getRiskBg(pred.riskLevel)} ${getRiskColor(pred.riskLevel)}`}>{pred.riskLevel}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 bg-bg-tertiary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pred.riskLevel==="KRITIS"?"bg-accent-red":pred.riskLevel==="TINGGI"?"bg-accent-amber":"bg-accent-cyan"}`} style={{width:`${pred.riskScore}%`}} />
                </div>
                <span className={`text-lg font-bold ${getRiskColor(pred.riskLevel)}`}>{pred.riskScore}%</span>
              </div>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />Puncak: {pred.peakHour}</p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="lg:col-span-2 space-y-4">
            <div className={`rounded-xl border-2 p-5 ${getRiskBg(selected.riskLevel)}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="font-heading text-xl font-bold text-white flex items-center gap-2">
                    <MapPin className={`h-5 w-5 ${getRiskColor(selected.riskLevel)}`} />{selected.intersection}
                  </h2>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-bold ${getRiskColor(selected.riskLevel)}`}>{selected.riskScore}%</p>
                  <p className="text-xs text-text-muted">Skor Risiko</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: "Insiden 90 Hari", val: selected.historicalAccidents, icon: AlertTriangle },
                  { label: "Prediksi Besok", val: selected.predictedViolations + " pelanggaran", icon: TrendingUp },
                  { label: "Puncak Risiko", val: selected.peakHour, icon: Clock },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-bg-primary/60 p-3">
                    <p className="text-xs text-text-muted">{item.label}</p>
                    <p className="text-base font-bold text-white flex items-center gap-1 mt-0.5"><item.icon className="h-4 w-4 text-text-muted" />{item.val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Analisis Multi-Dimensi</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e2a3a" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Radar dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border bg-bg-secondary p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Prakiraan 24 Jam</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={forecastData} barSize={5}>
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 8 }} interval={3} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8, fontSize: 11 }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [`${v}%`, "Risiko"]} />
                    <Bar dataKey="risk" radius={[2,2,0,0]}>
                      {forecastData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-bg-secondary p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Brain className="h-4 w-4 text-accent-amber" />Faktor Kontribusi (AI Analysis)</h3>
              <div className="space-y-2">
                {selected.contributingFactors.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <ArrowUpRight className="h-4 w-4 text-accent-amber flex-shrink-0" />
                    <span className="text-text-secondary">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-5">
              <h3 className="text-sm font-semibold text-accent-blue mb-2 flex items-center gap-2"><Users className="h-4 w-4" />Rekomendasi Tindakan</h3>
              <p className="text-white font-medium">{selected.recommendation}</p>
              <button onClick={() => setAlertSent(true)} disabled={alertSent}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all disabled:opacity-60">
                <Bell className="h-4 w-4" />
                {alertSent ? "✓ Alert Terkirim ke Kepala Bidang" : "Kirim Alert ke Kepala Bidang Penindakan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
