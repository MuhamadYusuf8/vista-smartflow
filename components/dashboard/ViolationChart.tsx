"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { type HourlyDataPoint } from "@/types";

interface ViolationChartProps {
  data: HourlyDataPoint[];
}

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
  payload: { total: number };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-bg-tertiary p-3 shadow-xl backdrop-blur-md">
        <p className="mb-2 font-medium text-white">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex flex-col gap-1">
            <span
              className="text-xs font-semibold uppercase"
              style={{ color: entry.color }}
            >
              {entry.name.replace(/_/g, " ")}: {entry.value}
            </span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-border">
          <span className="text-xs font-bold text-white">
            Total: {payload[0].payload.total}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export function ViolationChart({ data }: ViolationChartProps) {
  return (
    <div className="h-full w-full" style={{ minHeight: 300 }}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorParking" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBusway" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBike" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E2D4D" />
          <XAxis 
            dataKey="hour" 
            stroke="#94A3B8" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis 
            stroke="#94A3B8" 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="ILLEGAL_PARKING"
            name="Illegal Parking"
            stroke="#EF4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorParking)"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="BUSWAY_VIOLATION"
            name="Busway"
            stroke="#F59E0B"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBusway)"
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="BICYCLE_LANE_VIOLATION"
            name="Bike Lane"
            stroke="#10B981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorBike)"
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
