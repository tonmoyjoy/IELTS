"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BandPoint = {
  label: string;
  band: number;
};

type Props = {
  data: BandPoint[];
  title?: string;
  emptyLabel?: string;
};

export function ProgressChart({ data, title = "Band progress", emptyLabel = "Complete a speaking test to see your band trend." }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="h-72 min-w-0 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="h-60 min-h-0 min-w-0 overflow-x-auto">
        <LineChart width={680} height={230} data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-zinc-500" />
          <YAxis domain={[0, 9]} tickCount={10} tick={{ fontSize: 11 }} className="text-zinc-500" />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid rgb(228 228 231)",
              background: "white",
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Line
            type="monotone"
            dataKey="band"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Overall band"
          />
        </LineChart>
      </div>
    </div>
  );
}
