/** Sample Gemini output (intermediate draft format) shared by unit and integration tests. */
const paragraphs = [
  "Bees navigate using the position of the sun, even on cloudy days.",
  "Researchers in Austria first described the waggle dance in detail.",
  "Forager bees share the distance to flowers through the length of the dance.",
  "Some scientists believe magnetic fields also play a role, though evidence is limited.",
];

export const rawReading = {
  title: "How bees navigate",
  summary: "A passage about bee navigation.",
  heading: "Finding the way home",
  paragraphs,
  groups: [
    {
      type: "tfng",
      instructions: "Do the statements agree with the passage?",
      questions: [
        { prompt: "Bees can navigate on cloudy days.", answer: "TRUE", explanation: "Paragraph A says so." },
        { prompt: "The waggle dance was first described in Germany.", answer: "false", explanation: "It was Austria." },
      ],
    },
    {
      type: "matching",
      instructions: "Which paragraph contains the information?",
      questions: [{ prompt: "evidence that is limited", answer: "Paragraph D", explanation: "Paragraph D." }],
    },
    {
      type: "mcq",
      instructions: "Choose the correct letter.",
      questions: [{ prompt: "Distance is shown by", options: ["A. colour", "B. the length of the dance", "C. sound"], answer: "B", explanation: "Paragraph C." }],
    },
    {
      type: "completion",
      instructions: "Write ONE WORD ONLY.",
      maxWords: 1,
      allowNumber: false,
      questions: [{ prompt: "Bees use the position of the ____.", answer: "sun", explanation: "Paragraph A." }],
    },
  ],
};
