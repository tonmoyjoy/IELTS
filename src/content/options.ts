import type { ChoiceOption } from "@/content/types";

export const TFNG_OPTIONS: ChoiceOption[] = [
  { value: "TRUE", label: "TRUE" },
  { value: "FALSE", label: "FALSE" },
  { value: "NOT GIVEN", label: "NOT GIVEN" },
];

export const YNNG_OPTIONS: ChoiceOption[] = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
  { value: "NOT GIVEN", label: "NOT GIVEN" },
];

export function letterOptions(labels: string[]): ChoiceOption[] {
  return labels.map((label, index) => {
    const letter = String.fromCharCode(65 + index);
    return { value: letter, label: `${letter}  ${label}` };
  });
}

export function paragraphOptions(count: number): ChoiceOption[] {
  return Array.from({ length: count }, (_, index) => {
    const letter = String.fromCharCode(65 + index);
    return { value: letter, label: `Paragraph ${letter}` };
  });
}
