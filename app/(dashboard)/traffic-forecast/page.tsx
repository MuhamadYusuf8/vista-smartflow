"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Navigation, AlertTriangle, Clock, RefreshCw,
  TrendingUp, TrendingDown, Minus, MapPin, Zap,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

type CongestionLevel = "LANCAR" | "PADAT" | "MACET" | "MACET TOTAL";

interface RoadForecast {
  road: { id: string; name: string; lat: number; lng: number };
  current: {
    score: number;
    level: CongestionLevel;
    color: string;
    speedEstimateKmh: number;
    travelTimeMultiplier: string;
  };
  forecast: Array<{
    time: string;
    minutesAhead: number;
    score: number;
    level: CongestionLevel;
    color: string;
  }>;
  warning: string;
  willWorsen: boolean;
  peakIn: number | null;
}

interface ForecastData {
  timestamp: string;
  jakartaOverall: {
    avgCongestionScore: number;
    level: CongestionLevel;
    color: string;
    recommendation: string;
    recentViolationsLastHour: number;
  };
  roads: RoadForecast[];
}

const LEVEL_EMOJI: Record<string, string> = {
  LANCAR: "🟢",
  PADAT: "🟡",
  MACET: "🟠",
  "MACET TOTAL": "🔴",
};

export default function TrafficForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoad, setSelectedRoad] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/traffic-forecast");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 90000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const selectedRoadData = selectedRoad
    ? data?.roads.find((r) => r.road.id === selectedRoad)
    : null;

  const overall = data?.jakartaOverall;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-3">
            <Navigation className="h-7 w-7 text-accent-cyan" />
            Prediksi Kemacetan AI
          </h1>
          <p className="text-sm text-text-muted">
            Forecasting lalu lintas Jakarta berbasis volume kendaraan dan data pelanggaran
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-4 py-2 text-sm font-medium text-white hover:bg-border"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Update
        </button>
      </div>

      {/* Overall Jakarta Status */}
      {overall && (
        <div className="rounded-2xl border border-border bg-bg-secondary p-6 flex flex-col sm:flex-row gap-6 items-center">
          <div
            className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full text-5xl border-4"
            style={{ borderColor: overall.color, backgroundColor: `${overall.color}15` }}
          >
            {LEVEL_EMOJI[overall.level]}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm text-text-muted mb-1">Status Lalu Lintas Jakarta</p>
            <p className="text-3xl font-bold text-white mb-1">{overall.level}</p>
            <p className="text-text-secondary">{overall.recommendation}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg bg-bg-tertiary px-4 py-3">
              <p className="text-xs text-text-muted">Skor Kemacetan</p>
              <p className="text-2xl font-bold text-white">{overall.avgCongestionScore}/100</p>
            </div>
            <div className="rounded-lg bg-bg-tertiary px-4 py-3">
              <p className="text-xs text-text-muted">Pelanggaran 1 Jam Ini</p>
              <p className="text-2xl font-bold text-accent-red">{overall.recentViolationsLastHour}</p>
            </div>
          </div>
        </div>
      )}

      {/* Road Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.roads ?? Array.from({ length: 6 })).map((forecast, i) => {
          if (!forecast) {
            return (
              <div key={i} className="rounded-xl border border-border bg-bg-secondary p-5 animate-pulse">
                <div className="h-5 w-36 bg-bg-tertiary rounded mb-3" />
                <div className="h-8 w-24 bg-bg-tertiary rounded mb-2" />
                <div className="h-4 w-full bg-bg-tertiary rounded" />
              </div>
            );
          }

          const f = forecast as RoadForecast;
          const isSelected = selectedRoad === f.road.id;

          return (
            <button
              key={f.road.id}
              onClick={() => setSelectedRoad(isSelected ? null : f.road.id)}
              className={cn(
                "rounded-xl border p-5 text-left transition-all",
                isSelected
                  ? "border-accent-cyan bg-accent-cyan/10"
                  : f.willWorsen
                  ? "border-accent-red/30 bg-bg-secondary hover:border-accent-red/50"
                  : "border-border bg-bg-secondary hover:border-border/80 hover:bg-bg-tertiary"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <MapPin className="h-4 w-4 text-text-muted" />
                    <span className="text-sm font-semibold text-white">{f.road.name}</span>
                  </div>
                </div>
                <span className="text-lg">{LEVEL_EMOJI[f.current.level]}</span>
              </div>

              <div className="flex items-end gap-3 mb-3">
                <span
                  className="text-3xl font-bold"
                  style={{ color: f.current.color }}
                >
                  {f.current.score}
                </span>
                <div className="pb-1 text-text-muted text-xs">
                  <div>{f.current.level}</div>
                  <div>~{f.current.speedEstimateKmh} km/h</div>
                </div>
              </div>

              {/* Mini forecast bar */}
              <div className="flex gap-0.5 mb-3">
                {f.forecast.slice(0, 8).map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${12 + pt.score * 0.2}px`,
                      backgroundColor: pt.color,
                      opacity: 0.7 + idx * 0.04,
                    }}
                    title={`${pt.time}: ${pt.level}`}
                  />
                ))}
              </div>

              <p className={cn(
                "text-xs",
                f.willWorsen ? "text-accent-red" : "text-accent-green"
              )}>
                {f.willWorsen
                  ? <><AlertTriangle className="inline h-3 w-3 mr-1" />{f.warning}</>
                  : <><Zap className="inline h-3 w-3 mr-1" />{f.warning.replace("✅ ", "").replace("🔴 ", "")}</>
                }
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail Chart for selected road */}
      {selectedRoadData && (
        <div className="rounded-xl border border-accent-cyan/30 bg-bg-secondary p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-heading text-lg font-bold text-white">
                📈 Prakiraan 4 Jam ke Depan — {selectedRoadData.road.name}
              </h2>
              <p className="text-sm text-text-muted">
                Skor kemacetan: 0 = Lancar, 100 = Macet Total
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: selectedRoadData.current.color }}>
                {selectedRoadData.current.score}/100
              </p>
              <p className="text-xs text-text-muted">{selectedRoadData.current.level}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={selectedRoadData.forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [Number(v ?? 0), "Skor Kemacetan"]}
                contentStyle={{ background: "#0f1923", border: "1px solid #1e2a3a", borderRadius: 8 }}
                labelStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#22D3EE"
                strokeWidth={2.5}
                dot={{ fill: "#22D3EE", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Saat Ini", value: `${selectedRoadData.current.speedEstimateKmh} km/h` },
              { label: "Estimasi Waktu", value: `${selectedRoadData.current.travelTimeMultiplier}× normal` },
              { label: "Puncak Kemacetan", value: selectedRoadData.peakIn ? `${selectedRoadData.peakIn} menit lagi` : "Tidak diprakirakan" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-bg-tertiary p-3 text-center">
                <p className="text-xs text-text-muted mb-1">{item.label}</p>
                <p className="text-sm font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted text-center">
        🤖 Model: VISTA-TrafficPredict-v1 | Data diperbarui setiap 90 detik | Akurasi prakiraan ±15%
      </p>
    </div>
  );
}
