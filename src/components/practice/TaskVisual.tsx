"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LineChartVisual, ProcessVisual } from "@/content/types";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
// Dash patterns keep series distinguishable without relying on colour alone.
const DASHES = ["", "6 3", "2 3", "10 4 2 4", "4 4"];
const AXIS = { fontSize: 12, fill: "var(--ink-soft)" };
const TOOLTIP = { borderRadius: 12, fontSize: 12, background: "var(--raised)", border: "1px solid var(--line)", color: "var(--ink)" };

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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="category" tick={AXIS} stroke="var(--line-strong)" />
            <YAxis unit={visual.unit} tick={AXIS} stroke="var(--line-strong)" domain={[0, "auto"]} />
            <Tooltip formatter={(value) => `${value}${visual.unit}`} contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-soft)" }} />
            {visual.series.map((series, index) => (
              <Line key={series.name} type="linear" dataKey={series.name} stroke={COLORS[index % COLORS.length]} strokeDasharray={DASHES[index % DASHES.length]} strokeWidth={2.25} dot={{ r: 3.5, strokeWidth: 0, fill: COLORS[index % COLORS.length] }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-ink-faint">Show data as a table (not available in the real test)</summary>
      <table className="mt-2 w-full text-xs tabular-nums">
        <caption className="sr-only">{visual.title} data</caption>
        <thead>
          <tr className="text-left text-ink-faint">
            <th className="py-1 pr-2 font-medium">{visual.xLabel}</th>
            {visual.series.map((s) => (
              <th key={s.name} className="py-1 pr-2 font-medium">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visual.categories.map((category, index) => (
            <tr key={category} className="border-t border-line">
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
            <div className="flex gap-3 rounded-lg border border-line bg-sunken p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-btn text-xs font-bold text-on-accent">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm text-ink-soft">{step.detail}</p>
              </div>
            </div>
            {index < visual.steps.length - 1 && (
              <div className="ml-6 h-3 w-px bg-line-strong" aria-hidden />
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
