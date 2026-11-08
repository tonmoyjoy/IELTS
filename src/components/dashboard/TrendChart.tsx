"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MODULE_LABELS, type IeltsModule } from "@/lib/modules";

type Point = { date: string; module: IeltsModule; score: number };

export function TrendChart({ points, target }: { points: Point[]; target: number }) {
  const data = points.map((point, index) => ({
    index: index + 1,
    score: point.score,
    label: `${MODULE_LABELS[point.module]} · ${new Date(point.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
  }));

  return (
    <div className="h-64 w-full" role="img" aria-label={`Line chart of your last ${points.length} band scores`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="index" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} stroke="var(--line-strong)" tickLine={false} />
          <YAxis domain={[0, 9]} ticks={[0, 3, 5, 6, 7, 8, 9]} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} stroke="var(--line-strong)" tickLine={false} />
          <ReferenceLine y={target} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: "Target", fontSize: 11, fill: "var(--warn)", position: "insideTopRight" }} />
          <Tooltip
            formatter={(value) => [`Band ${value}`, "Score"]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""}
            contentStyle={{ borderRadius: 12, fontSize: 12, background: "var(--raised)", border: "1px solid var(--line)", color: "var(--ink)" }}
          />
          <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 0, fill: "var(--accent)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
