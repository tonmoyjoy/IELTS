export type IeltsModule = "speaking" | "writing" | "reading" | "listening";

export type ReadingQuestion = {
  id: string;
  question: string;
  answer: string;
  type: "true-false-not-given" | "short-answer" | "matching";
};

export type ListeningQuestion = {
  id: string;
  question: string;
  answer: string;
  type: "form-completion" | "multiple-choice" | "sentence-completion";
};

export type SpeakingSet = {
  id: string;
  title: string;
  part1: string[];
  part2: {
    cue: string;
    bullets: string[];
  };
  part3: string[];
};

export const ieltsOverview = [
  {
    module: "listening" as const,
    title: "Listening",
    duration: "About 30 minutes",
    format: "4 recordings, 40 questions",
    focus: "Main ideas, factual detail, speaker attitude, purpose, and argument flow",
  },
  {
    module: "reading" as const,
    title: "Reading",
    duration: "60 minutes",
    format: "3 sections, 40 questions",
    focus: "Skimming, scanning, detail, writer views, matching, and completion tasks",
  },
  {
    module: "writing" as const,
    title: "Writing",
    duration: "60 minutes",
    format: "2 tasks",
    focus: "Task achievement, coherence, lexical resource, grammar, and task response",
  },
  {
    module: "speaking" as const,
    title: "Speaking",
    duration: "11-14 minutes",
    format: "3 parts",
    focus: "Fluency, vocabulary, grammar, pronunciation, and extended discussion",
  },
];

export const speakingSets: SpeakingSet[] = [
  {
    id: "skills-and-learning",
    title: "Skills and learning",
    part1: [
      "Do you work or study?",
      "What do you usually do in the evening?",
      "Do you prefer living in a quiet place or a busy place?",
    ],
    part2: {
      cue: "Describe a skill you learned that was useful to you.",
      bullets: [
        "what the skill was",
        "when and how you learned it",
        "how often you use it",
        "and explain why it is useful",
      ],
    },
    part3: [
      "Why do some people find it difficult to learn new skills?",
      "Should schools focus more on practical skills?",
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
      "Should governments invest more in trains or roads?",
      "How might transport change in the future?",
    ],
  },
  {
    id: "technology-and-work",
    title: "Technology and work",
    part1: [
      "What technology do you use every day?",
      "Do you think people spend too much time online?",
      "What device would be difficult for you to live without?",
    ],
    part2: {
      cue: "Describe a piece of technology that helps you study or work.",
      bullets: [
        "what it is",
        "when you started using it",
        "what you use it for",
        "and explain why it is helpful",
      ],
    },
    part3: [
      "How has technology changed workplaces?",
      "Can technology make people less creative?",
      "What digital skills should young people learn?",
    ],
  },
];

export const speakingPrompts = speakingSets[0];

export const writingTasks = [
  {
    id: "academic-task-1",
    label: "Academic Task 1",
    minutes: 20,
    minWords: 150,
    prompt:
      "The chart below shows the percentage of households in one country using five different energy sources between 2000 and 2025. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  },
  {
    id: "task-2",
    label: "Task 2 Essay",
    minutes: 40,
    minWords: 250,
    prompt:
      "Some people believe that universities should focus on practical skills for employment, while others think they should prioritise academic knowledge. Discuss both views and give your own opinion.",
  },
  {
    id: "academic-task-1-process",
    label: "Academic Task 1 Process",
    minutes: 20,
    minWords: 150,
    prompt:
      "The diagram shows the process of producing drinking water from seawater using a desalination plant. Summarise the main stages and make comparisons where relevant.",
  },
  {
    id: "task-2-environment",
    label: "Task 2 Environment",
    minutes: 40,
    minWords: 250,
    prompt:
      "Some people think individuals can do little to improve the environment, while others believe individual action is essential. Discuss both views and give your own opinion.",
  },
];

export const readingPracticeSets = [
  {
    id: "urban-green-spaces",
    title: "Academic Reading Set 1: Urban Green Spaces",
    passage:
      "Urban green spaces are increasingly seen as essential infrastructure rather than decorative extras. Researchers have found that parks, tree-lined streets, and community gardens can reduce heat, support biodiversity, and improve residents' mental health. However, the benefits are not always distributed equally. In many cities, wealthier districts have more shade and safer parks, while lower-income neighbourhoods may have fewer maintained outdoor areas. City planners are now using satellite data, public health records, and community surveys to decide where new green spaces should be developed first.",
    questions: [
      { id: "r1", type: "true-false-not-given", question: "Urban green spaces are now viewed only as decorative features.", answer: "false" },
      { id: "r2", type: "short-answer", question: "Name one tool city planners use to decide where green spaces are needed.", answer: "satellite data" },
      { id: "r3", type: "short-answer", question: "Which type of neighbourhood may have fewer maintained outdoor areas?", answer: "lower-income" },
      { id: "r4", type: "short-answer", question: "What can green spaces reduce in cities?", answer: "heat" },
    ] satisfies ReadingQuestion[],
  },
  {
    id: "remote-work",
    title: "Academic Reading Set 2: Remote Work",
    passage:
      "Remote work expanded rapidly after organisations discovered that many knowledge-based jobs could be performed away from the office. Supporters argue that flexible work reduces commuting time and allows employees to organise their day more efficiently. Critics, however, point to weaker informal communication, fewer mentoring opportunities and the risk that home responsibilities interrupt concentration. Several companies now use hybrid policies, asking employees to attend the office for collaborative tasks while reserving independent work for home.",
    questions: [
      { id: "r5", type: "short-answer", question: "What kind of jobs are mentioned as suitable for remote work?", answer: "knowledge-based" },
      { id: "r6", type: "true-false-not-given", question: "Remote work always improves mentoring opportunities.", answer: "false" },
      { id: "r7", type: "short-answer", question: "What do hybrid policies reserve for home?", answer: "independent work" },
      { id: "r8", type: "short-answer", question: "What does flexible work reduce?", answer: "commuting time" },
    ] satisfies ReadingQuestion[],
  },
  {
    id: "food-waste",
    title: "Academic Reading Set 3: Food Waste",
    passage:
      "Food waste occurs at every stage of the supply chain. Farms may reject produce that does not meet appearance standards, supermarkets often overstock perishable goods, and households sometimes buy more than they can use. Reducing waste can lower pressure on land and water resources while also cutting greenhouse gas emissions from landfill. Some cities have introduced food-sharing apps and composting schemes, but experts argue that prevention is more effective than disposal after food has already been wasted.",
    questions: [
      { id: "r9", type: "short-answer", question: "Where can food waste occur?", answer: "supply chain" },
      { id: "r10", type: "short-answer", question: "What do supermarkets often overstock?", answer: "perishable goods" },
      { id: "r11", type: "true-false-not-given", question: "Experts say prevention is less effective than disposal.", answer: "false" },
      { id: "r12", type: "short-answer", question: "Name one resource affected by food waste.", answer: "water" },
    ] satisfies ReadingQuestion[],
  },
];

export const readingPractice = readingPracticeSets[0];

export const listeningPracticeSets = [
  {
    id: "sports-centre",
    title: "Listening Set 1: Sports Centre Booking",
    audioSrc: "/listening/section-1.mp3",
    transcript:
      "Good morning, Greenfield Sports Centre. How can I help? Hello, I would like to book a beginner swimming course. Certainly. The next course starts on Monday the 12th. It runs for six weeks, every Monday at 7 p.m. The instructor is Ms Carter, and the total fee is 85 pounds.",
    questions: [
      { id: "l1", type: "form-completion", question: "Course level: ____", answer: "beginner" },
      { id: "l2", type: "sentence-completion", question: "The course starts on Monday the ____.", answer: "12th" },
      { id: "l3", type: "form-completion", question: "Total fee: ____ pounds", answer: "85" },
    ] satisfies ListeningQuestion[],
  },
  {
    id: "library-tour",
    title: "Listening Set 2: Library Tour",
    audioSrc: "/listening/section-1.mp3",
    transcript:
      "Welcome to the campus library tour. The information desk is on the ground floor, next to the cafe. Study rooms can be booked online for two-hour periods. The history collection is on level three, and laptops are available from the technology desk with a student card.",
    questions: [
      { id: "l4", type: "form-completion", question: "Information desk location: ____ floor", answer: "ground" },
      { id: "l5", type: "sentence-completion", question: "Study rooms are booked for ____ periods.", answer: "two-hour" },
      { id: "l6", type: "form-completion", question: "History collection: level ____", answer: "three" },
    ] satisfies ListeningQuestion[],
  },
  {
    id: "community-garden",
    title: "Listening Set 3: Community Garden",
    audioSrc: "/listening/section-1.mp3",
    transcript:
      "The community garden meeting will be held on Thursday evening at 6:30 in Room B. Volunteers should bring gloves and a water bottle. This month the group will plant herbs near the south fence and repair the wooden benches beside the entrance.",
    questions: [
      { id: "l7", type: "form-completion", question: "Meeting day: ____", answer: "Thursday" },
      { id: "l8", type: "sentence-completion", question: "Volunteers should bring gloves and a ____.", answer: "water bottle" },
      { id: "l9", type: "form-completion", question: "Plants near the south fence: ____", answer: "herbs" },
    ] satisfies ListeningQuestion[],
  },
];

export const listeningPractice = listeningPracticeSets[0];

export function convertRawToBand(raw: number, total: number): number {
  if (total <= 0) return 0;
  const pct = raw / total;
  if (pct >= 0.95) return 9;
  if (pct >= 0.875) return 8;
  if (pct >= 0.75) return 7;
  if (pct >= 0.625) return 6;
  if (pct >= 0.5) return 5;
  if (pct >= 0.375) return 4;
  if (pct >= 0.25) return 3;
  if (pct > 0) return 2;
  return 0;
}

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
