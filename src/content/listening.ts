import type { ListeningSet } from "@/content/types";
import { letterOptions } from "@/content/options";

export const listeningSets: ListeningSet[] = [
  {
    id: "sports-centre",
    title: "Sports Centre Booking",
    summary: "A caller books a swimming course. Form completion and multiple choice.",
    section: 1,
    audioSrc: "/listening/sports-centre.mp3",
    groups: [
      {
        range: "Questions 1–7",
        instructions: "Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
        questions: [
          { id: "sc-1", number: 1, kind: "text", maxWords: 1, allowNumber: true, prompt: "Course level: ____" },
          { id: "sc-2", number: 2, kind: "text", maxWords: 1, allowNumber: true, prompt: "Start date: Monday ____ May" },
          { id: "sc-3", number: 3, kind: "text", maxWords: 1, allowNumber: true, prompt: "Time: 7 pm to ____ pm" },
          { id: "sc-4", number: 4, kind: "text", maxWords: 1, allowNumber: true, prompt: "Instructor: Ms ____" },
          { id: "sc-5", number: 5, kind: "text", maxWords: 1, allowNumber: true, prompt: "Course fee for non-members: £____" },
          { id: "sc-6", number: 6, kind: "text", maxWords: 1, allowNumber: true, prompt: "Name: David ____" },
          { id: "sc-7", number: 7, kind: "text", maxWords: 1, allowNumber: true, prompt: "Address: 42 ____ Road" },
        ],
      },
      {
        range: "Questions 8–10",
        instructions: "Choose the correct letter, A, B or C.",
        questions: [
          {
            id: "sc-8",
            number: 8,
            kind: "choice",
            prompt: "What must students bring to every lesson?",
            options: letterOptions(["goggles", "a towel and a swimming cap", "a membership card"]),
          },
          {
            id: "sc-9",
            number: 9,
            kind: "choice",
            prompt: "Where is the car park?",
            options: letterOptions(["in front of the building", "behind the building", "across the road"]),
          },
          {
            id: "sc-10",
            number: 10,
            kind: "choice",
            prompt: "How long is parking free?",
            options: letterOptions(["one hour", "two hours", "the whole evening"]),
          },
        ],
      },
    ],
  },
  {
    id: "library-tour",
    title: "Campus Library Tour",
    summary: "A guide explains how a university library is organised. Sentence completion and multiple choice.",
    section: 2,
    audioSrc: "/listening/library-tour.mp3",
    groups: [
      {
        range: "Questions 1–7",
        instructions: "Complete the sentences below. Write ONE WORD AND/OR A NUMBER for each answer.",
        questions: [
          { id: "lt-1", number: 1, kind: "text", maxWords: 1, allowNumber: true, prompt: "The information desk is next to the ____." },
          { id: "lt-2", number: 2, kind: "text", maxWords: 1, allowNumber: true, prompt: "On weekdays the information desk closes at ____ pm." },
          { id: "lt-3", number: 3, kind: "text", maxWords: 1, allowNumber: true, prompt: "Undergraduates can borrow up to ____ books at a time." },
          { id: "lt-4", number: 4, kind: "text", maxWords: 1, allowNumber: true, prompt: "The standard loan period is ____ weeks." },
          { id: "lt-5", number: 5, kind: "text", maxWords: 1, allowNumber: true, prompt: "The ____ floor is a silent study area." },
          { id: "lt-6", number: 6, kind: "text", maxWords: 1, allowNumber: true, prompt: "Group study rooms are booked online for ____ periods." },
          { id: "lt-7", number: 7, kind: "text", maxWords: 1, allowNumber: true, prompt: "Each study room holds up to ____ people." },
        ],
      },
      {
        range: "Questions 8–10",
        instructions: "Choose the correct letter, A, B or C.",
        questions: [
          {
            id: "lt-8",
            number: 8,
            kind: "choice",
            prompt: "Where are the history and politics collections?",
            options: letterOptions(["on the ground floor", "on level two", "on level three"]),
          },
          {
            id: "lt-9",
            number: 9,
            kind: "choice",
            prompt: "What must students do to see the rare books?",
            options: letterOptions(["pay a small fee", "make an appointment at least two days ahead", "ask a lecturer to sign a form"]),
          },
          {
            id: "lt-10",
            number: 10,
            kind: "choice",
            prompt: "Where is the technology desk?",
            options: letterOptions(["in the basement", "on the ground floor", "on the second floor"]),
          },
        ],
      },
    ],
  },
  {
    id: "community-garden",
    title: "Community Garden Volunteers",
    summary: "A new volunteer calls a community garden. Note completion and multiple choice.",
    section: 1,
    audioSrc: "/listening/community-garden.mp3",
    groups: [
      {
        range: "Questions 1–8",
        instructions: "Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
        questions: [
          { id: "cg-1", number: 1, kind: "text", maxWords: 2, allowNumber: true, prompt: "Monthly meeting day: ____" },
          { id: "cg-2", number: 2, kind: "text", maxWords: 2, allowNumber: true, prompt: "Meeting time: ____ pm" },
          { id: "cg-3", number: 3, kind: "text", maxWords: 2, allowNumber: true, prompt: "Meeting place: Room ____, community centre" },
          { id: "cg-4", number: 4, kind: "text", maxWords: 2, allowNumber: true, prompt: "Practical work takes place on ____ mornings." },
          { id: "cg-5", number: 5, kind: "text", maxWords: 2, allowNumber: true, prompt: "This month: planting ____ near the south fence" },
          { id: "cg-6", number: 6, kind: "text", maxWords: 2, allowNumber: true, prompt: "Repairing the wooden ____ beside the entrance" },
          { id: "cg-7", number: 7, kind: "text", maxWords: 2, allowNumber: true, prompt: "Volunteers should bring gloves and a ____." },
          { id: "cg-8", number: 8, kind: "text", maxWords: 2, allowNumber: true, prompt: "Yearly contribution towards insurance: £____" },
        ],
      },
      {
        range: "Questions 9–10",
        instructions: "Choose the correct letter, A, B or C.",
        questions: [
          {
            id: "cg-9",
            number: 9,
            kind: "choice",
            prompt: "Where do most of the vegetables go?",
            options: letterOptions(["to the Sunday market", "to the local food bank", "to the volunteers"]),
          },
          {
            id: "cg-10",
            number: 10,
            kind: "choice",
            prompt: "What is the money from the market stall used for?",
            options: letterOptions(["insurance", "new tools", "seeds"]),
          },
        ],
      },
    ],
  },
];

export function getListeningSet(id: string): ListeningSet | undefined {
  return listeningSets.find((set) => set.id === id);
}
