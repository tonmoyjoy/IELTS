import type { WritingTask } from "@/content/types";

export const writingTasks: WritingTask[] = [
  {
    id: "task1-home-heating",
    task: 1,
    title: "Home heating sources, 2000–2025",
    minutes: 20,
    minWords: 150,
    prompt:
      "The chart below shows the percentage of households in one country using five different sources of energy for home heating between 2000 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    visual: {
      kind: "line-chart",
      title: "Households by main heating source (%)",
      xLabel: "Year",
      yLabel: "Households",
      unit: "%",
      categories: ["2000", "2005", "2010", "2015", "2020", "2025"],
      series: [
        { name: "Gas", values: [52, 50, 47, 43, 38, 33] },
        { name: "Electricity", values: [20, 22, 24, 27, 30, 34] },
        { name: "Oil", values: [18, 15, 13, 10, 8, 6] },
        { name: "Solar", values: [1, 2, 4, 8, 13, 19] },
        { name: "Wood", values: [9, 11, 12, 12, 11, 8] },
      ],
    },
  },
  {
    id: "task1-desalination",
    task: 1,
    title: "Producing drinking water from seawater",
    minutes: 20,
    minWords: 150,
    prompt:
      "The diagram below shows how drinking water is produced from seawater at a desalination plant. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    visual: {
      kind: "process",
      title: "Reverse-osmosis desalination",
      steps: [
        { title: "Intake", detail: "Seawater is drawn in through a pipe about 500 metres offshore." },
        { title: "Screening and filtering", detail: "Screens remove fish and debris; sand filters remove fine particles." },
        { title: "High-pressure pumping", detail: "Pumps force the water through reverse-osmosis membranes." },
        { title: "Separation", detail: "About 45% becomes fresh water; about 55% leaves as concentrated brine." },
        { title: "Brine return", detail: "Brine is diluted and returned to the sea through a diffuser." },
        { title: "Treatment", detail: "Minerals are added back to the fresh water and it is disinfected." },
        { title: "Storage and supply", detail: "Water is stored in a reservoir and piped to homes." },
      ],
    },
  },
  {
    id: "task2-university-purpose",
    task: 2,
    title: "Practical skills or academic knowledge",
    minutes: 40,
    minWords: 250,
    prompt:
      "Some people believe that universities should focus on providing practical skills for employment, while others think they should prioritise academic knowledge.",
    question: "Discuss both views and give your own opinion.",
  },
  {
    id: "task2-individual-environment",
    task: 2,
    title: "Individual action and the environment",
    minutes: 40,
    minWords: 250,
    prompt:
      "Some people think individuals can do little to improve the environment and that only governments and large companies can make a difference. Others believe individual action is essential.",
    question: "Discuss both views and give your own opinion.",
  },
  {
    id: "task2-community-service",
    task: 2,
    title: "Compulsory community service",
    minutes: 40,
    minWords: 250,
    prompt:
      "Some people believe that unpaid community service should be a compulsory part of high school programmes, for example working for a charity, improving the neighbourhood or teaching sports to younger children.",
    question: "To what extent do you agree or disagree?",
  },
];

export function getWritingTask(id: string): WritingTask | undefined {
  return writingTasks.find((task) => task.id === id);
}

/** Plain-text rendering of a task's visual, used so the AI examiner can check the data the candidate describes. */
export function describeVisual(task: WritingTask): string {
  const visual = task.visual;
  if (!visual) return "";
  if (visual.kind === "line-chart") {
    const header = `${visual.xLabel} | ${visual.series.map((s) => s.name).join(" | ")}`;
    const rows = visual.categories.map(
      (category, index) => `${category} | ${visual.series.map((s) => `${s.values[index]}${visual.unit}`).join(" | ")}`
    );
    return `${visual.title}\n${header}\n${rows.join("\n")}`;
  }
  return `${visual.title}\n${visual.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.detail}`).join("\n")}`;
}
