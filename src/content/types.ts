/**
 * Public content types. Nothing here contains answers: answer keys and
 * listening scripts live in `src/server/content` and are server-only.
 */

export type ChoiceOption = { value: string; label: string };

export type ChoiceQuestion = {
  id: string;
  number: number;
  kind: "choice";
  prompt: string;
  options: ChoiceOption[];
};

export type TextQuestion = {
  id: string;
  number: number;
  kind: "text";
  /** Use "____" to mark where the answer goes. */
  prompt: string;
  /** IELTS word limit, e.g. 1 for "ONE WORD ONLY". */
  maxWords: number;
  /** Whether a number is accepted in addition to words ("AND/OR A NUMBER"). */
  allowNumber: boolean;
};

export type Question = ChoiceQuestion | TextQuestion;

export type QuestionGroup = {
  /** e.g. "Questions 1–5" */
  range: string;
  instructions: string;
  questions: Question[];
};

export type ReadingSet = {
  id: string;
  title: string;
  summary: string;
  recommendedMinutes: number;
  passage: {
    heading: string;
    paragraphs: Array<{ label: string; text: string }>;
  };
  groups: QuestionGroup[];
};

export type ListeningSet = {
  id: string;
  title: string;
  summary: string;
  section: 1 | 2 | 3 | 4;
  audioSrc: string;
  groups: QuestionGroup[];
};

export type LineChartVisual = {
  kind: "line-chart";
  title: string;
  xLabel: string;
  yLabel: string;
  unit: string;
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
};

export type ProcessVisual = {
  kind: "process";
  title: string;
  steps: Array<{ title: string; detail: string }>;
};

export type WritingTask = {
  id: string;
  task: 1 | 2;
  title: string;
  minutes: number;
  minWords: number;
  /** The task instructions exactly as the candidate sees them. */
  prompt: string;
  question?: string;
  visual?: LineChartVisual | ProcessVisual;
};

export type SpeakingSet = {
  id: string;
  title: string;
  part1: string[];
  part2: { cue: string; bullets: string[] };
  part3: string[];
};

export function allQuestions(groups: QuestionGroup[]): Question[] {
  return groups.flatMap((group) => group.questions);
}
