import type { SpeakingSet } from "@/content/types";

export const speakingSets: SpeakingSet[] = [
  {
    id: "skills-and-learning",
    title: "Skills and learning",
    part1: [
      "Do you work or are you a student?",
      "What do you usually do in the evening?",
      "Do you prefer living in a quiet place or a busy place? Why?",
    ],
    part2: {
      cue: "Describe a skill you learned that was useful to you.",
      bullets: ["what the skill was", "when and how you learned it", "how often you use it", "and explain why it is useful"],
    },
    part3: [
      "Why do some people find it difficult to learn new skills?",
      "Should schools focus more on practical skills? Why or why not?",
      "How has technology changed the way people learn?",
    ],
  },
  {
    id: "cities-and-transport",
    title: "Cities and transport",
    part1: [
      "How do people usually travel in your city?",
      "Do you prefer public transport or private transport?",
      "Has traffic changed in your area recently?",
    ],
    part2: {
      cue: "Describe a journey you made that took longer than expected.",
      bullets: [
        "where you were going",
        "why it took longer than expected",
        "what you did during the journey",
        "and explain how you felt about it",
      ],
    },
    part3: [
      "What transport problems do large cities usually have?",
      "Should governments invest more in trains or in roads?",
      "How might transport change in the future?",
    ],
  },
  {
    id: "technology-and-work",
    title: "Technology and work",
    part1: [
      "What technology do you use every day?",
      "Do you think people spend too much time online?",
      "Which device would be difficult for you to live without?",
    ],
    part2: {
      cue: "Describe a piece of technology that helps you study or work.",
      bullets: ["what it is", "when you started using it", "what you use it for", "and explain why it is helpful"],
    },
    part3: [
      "How has technology changed workplaces?",
      "Can technology make people less creative?",
      "What digital skills should young people learn?",
    ],
  },
];

export function getSpeakingSet(id: string): SpeakingSet | undefined {
  return speakingSets.find((set) => set.id === id);
}
