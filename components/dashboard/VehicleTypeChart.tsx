"use client";

import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip as RechartsTooltip, Legend } from "recharts";
import { type VehicleTypeDataPoint } from "@/types";

interface VehicleTypeChartProps {
  data: VehicleTypeDataPoint[];
}

export function VehicleTypeChart({ data }: VehicleTypeChartProps) {
  return (
    <div className="h-full w-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-border bg-bg-tertiary p-3 shadow-xl backdrop-blur-md">
                    <p className="font-semibold text-white capitalize">
                      {payload[0].name}
                    </p>
                    <p className="text-sm mt-1" style={{ color: payload[0].payload.color }}>
                      Jumlah: <span className="font-bold">{payload[0].value}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            content={(props) => {
              const { payload } = props;
              return (
                <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
                  {payload?.map((entry, index) => (
                    <li key={`item-${index}`} className="flex items-center text-text-muted">
                      <span
                        className="mr-2 block h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="capitalize">{entry.value}</span>
                    </li>
                  ))}
                </ul>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
