"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LineChartVisual, ProcessVisual } from "@/content/types";

const COLORS = ["#059669", "#2563eb", "#d97706", "#db2777", "#7c3aed", "#0891b2"];

function LineChartFigure({ visual }: { visual: LineChartVisual }) {
  const data = visual.categories.map((category, index) => {
    const row: Record<string, string | number> = { category };
    for (const series of visual.series) row[series.name] = series.values[index];
    return row;
  });
  return (
    <figure>
      <figcaption className="mb-3 text-center text-sm font-semibold">{visual.title}</figcaption>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
            <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#71717a" }} />
            <YAxis unit={visual.unit} tick={{ fontSize: 12, fill: "#71717a" }} domain={[0, "auto"]} />
            <Tooltip formatter={(value) => `${value}${visual.unit}`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {visual.series.map((series, index) => (
              <Line key={series.name} type="linear" dataKey={series.name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-zinc-500">Show data as a table (not available in the real test)</summary>
      <table className="mt-2 w-full text-xs tabular-nums">
        <caption className="sr-only">{visual.title} data</caption>
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-1 pr-2 font-medium">{visual.xLabel}</th>
            {visual.series.map((s) => (
              <th key={s.name} className="py-1 pr-2 font-medium">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visual.categories.map((category, index) => (
            <tr key={category} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-1 pr-2">{category}</td>
              {visual.series.map((s) => (
                <td key={s.name} className="py-1 pr-2">{s.values[index]}{visual.unit}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </details>
    </figure>
  );
}

function ProcessFigure({ visual }: { visual: ProcessVisual }) {
  return (
    <figure>
      <figcaption className="mb-4 text-center text-sm font-semibold">{visual.title}</figcaption>
      <ol className="space-y-2">
        {visual.steps.map((step, index) => (
          <li key={step.title}>
            <div className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.detail}</p>
              </div>
            </div>
            {index < visual.steps.length - 1 && (
              <div className="ml-6 h-3 w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function TaskVisual({ visual }: { visual: LineChartVisual | ProcessVisual }) {
  return visual.kind === "line-chart" ? <LineChartFigure visual={visual} /> : <ProcessFigure visual={visual} />;
}
