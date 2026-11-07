import "server-only";

/**
 * Answer keys for reading and listening. Server-only: these never reach the
 * browser until after an attempt has been submitted and graded.
 *
 * `accept` lists every accepted form. Comparison is case-insensitive and
 * ignores surrounding punctuation and hyphen/space differences (see
 * grading.ts), so variants only need listing when the words differ.
 */

export type AnswerKey = {
  /** Shown to the candidate after submission. */
  display: string;
  accept: string[];
  explanation: string;
};

export const answerKeys: Record<string, AnswerKey> = {
  // ---- Reading: Urban Green Spaces ----
  "ugs-1": { display: "TRUE", accept: ["TRUE"], explanation: "Paragraph A: parks were 'the first item to be cut when budgets tightened'." },
  "ugs-2": { display: "FALSE", accept: ["FALSE"], explanation: "Paragraph B: trees cool cities 'in two ways' — shade and the water released through their leaves." },
  "ugs-3": { display: "NOT GIVEN", accept: ["NOT GIVEN"], explanation: "Paragraph B mentions the study but not how long it lasted." },
  "ugs-4": { display: "FALSE", accept: ["FALSE"], explanation: "Paragraph D: a small, well-maintained park 'tends to be used far more than a large field with no facilities'." },
  "ugs-5": { display: "NOT GIVEN", accept: ["NOT GIVEN"], explanation: "Paragraph F lists what residents might want but gives no figures for what most asked for." },
  "ugs-6": { display: "F", accept: ["F"], explanation: "New parks 'can raise local property prices, pushing out the very residents they were intended to help'." },
  "ugs-7": { display: "C", accept: ["C"], explanation: "Paved car parks are replaced with rain gardens." },
  "ugs-8": { display: "A", accept: ["A"], explanation: "Green spaces are 'comparable to roads or drainage systems'." },
  "ugs-9": { display: "B", accept: ["B"], explanation: "Urban areas 'absorb heat during the day and release it slowly at night'." },
  "ugs-10": { display: "afternoons", accept: ["afternoons"], explanation: "Paragraph B: 'up to four degrees cooler on summer afternoons'." },
  "ugs-11": { display: "gardens", accept: ["gardens"], explanation: "Paragraph C: 'planted areas known as rain gardens'." },
  "ugs-12": { display: "asthma", accept: ["asthma"], explanation: "Paragraph F: 'conditions such as asthma are most common'." },

  // ---- Reading: The Hybrid Office ----
  "hyb-1": { display: "YES", accept: ["YES"], explanation: "Paragraph C: the disadvantages are 'in my view, more serious'." },
  "hyb-2": { display: "NO", accept: ["NO"], explanation: "Paragraph C: informal moments 'are difficult to recreate on video calls'." },
  "hyb-3": { display: "NOT GIVEN", accept: ["NOT GIVEN"], explanation: "The writer never discusses pay." },
  "hyb-4": { display: "NO", accept: ["NO"], explanation: "Paragraph E: 'it seems unlikely that office work will ever return completely to its earlier form'." },
  "hyb-5": { display: "B", accept: ["B"], explanation: "Paragraph A: 'those sharing small homes with family members, found the opposite'." },
  "hyb-6": { display: "C", accept: ["C"], explanation: "Paragraph B: employers 'can recruit from a much wider area'." },
  "hyb-7": { display: "B", accept: ["B"], explanation: "Paragraph C: 'Junior staff appear to suffer most'." },
  "hyb-8": { display: "fixed days", accept: ["fixed days"], explanation: "Paragraph D: 'two or three fixed days each week'." },
  "hyb-9": { display: "concentration", accept: ["concentration"], explanation: "Paragraph D: 'independent work that requires concentration is done at home'." },
  "hyb-10": { display: "video calls", accept: ["video calls"], explanation: "Paragraph D: 'a place to hold video calls'." },
  "hyb-11": { display: "booths", accept: ["booths"], explanation: "Paragraph E: 'meeting rooms, quiet booths and shared tables'." },
  "hyb-12": { display: "third", accept: ["third"], explanation: "Paragraph E: 'by as much as a third'." },

  // ---- Reading: The Cost of Food Waste ----
  "fw-1": { display: "FALSE", accept: ["FALSE"], explanation: "Paragraph A: in lower-income countries most loss happens 'early in the supply chain'." },
  "fw-2": { display: "TRUE", accept: ["TRUE"], explanation: "Paragraph B: 'empty shelves are thought to discourage customers'." },
  "fw-3": { display: "NOT GIVEN", accept: ["NOT GIVEN"], explanation: "The passage says they are safe to eat but says nothing about nutrients." },
  "fw-4": { display: "FALSE", accept: ["FALSE"], explanation: "Paragraph C: food 'is usually still safe' after its best before date." },
  "fw-5": { display: "storage", accept: ["storage"], explanation: "Paragraph A: 'farmers lack cool storage'." },
  "fw-6": { display: "safety", accept: ["safety"], explanation: "Paragraph C: a 'use by' date 'relates to safety'." },
  "fw-7": { display: "methane", accept: ["methane"], explanation: "Paragraph D: landfill food 'releases methane'." },
  "fw-8": { display: "discount", accept: ["discount"], explanation: "Paragraph E: 'sell imperfect vegetables at a discount'." },
  "fw-9": { display: "C", accept: ["C"], explanation: "Paragraph D: 'Composting is better than landfill, but it still wastes the resources'." },
  "fw-10": { display: "B", accept: ["B"], explanation: "Paragraph E: stores must 'donate it to charities instead'." },
  "fw-11": { display: "third", accept: ["third"], explanation: "Paragraph A: 'roughly a third of all food'." },
  "fw-12": { display: "apps", accept: ["apps"], explanation: "Paragraph E: 'Food-sharing apps allow shops and neighbours to give away surplus items'." },

  // ---- Listening: Sports Centre Booking ----
  "sc-1": { display: "beginner", accept: ["beginner", "beginners"], explanation: "'I think I need the beginner course.'" },
  "sc-2": { display: "12th", accept: ["12th", "12", "twelfth"], explanation: "'The next one starts on Monday the twelfth of May.'" },
  "sc-3": { display: "8", accept: ["8", "eight", "8.00", "8:00"], explanation: "'from seven until eight o'clock'." },
  "sc-4": { display: "Carter", accept: ["Carter"], explanation: "The receptionist spells it: C-A-R-T-E-R." },
  "sc-5": { display: "85", accept: ["85", "eighty-five", "85.00"], explanation: "Members pay £76; 'for non-members the full price is eighty-five pounds'." },
  "sc-6": { display: "Henson", accept: ["Henson"], explanation: "The caller spells it: H-E-N-S-O-N." },
  "sc-7": { display: "Mill", accept: ["Mill"], explanation: "'Forty-two Mill Road.'" },
  "sc-8": { display: "B", accept: ["B"], explanation: "'You'll need to bring your own towel and a swimming cap. Goggles are optional.'" },
  "sc-9": { display: "B", accept: ["B"], explanation: "'There's a car park behind the building, not the one across the road.'" },
  "sc-10": { display: "B", accept: ["B"], explanation: "'Free for the first two hours.'" },

  // ---- Listening: Campus Library Tour ----
  "lt-1": { display: "cafe", accept: ["cafe", "café"], explanation: "'The information desk is just to your left, next to the cafe.'" },
  "lt-2": { display: "10", accept: ["10", "ten", "10.00", "10:00"], explanation: "'On weekdays the desk is open from eight in the morning until ten at night.'" },
  "lt-3": { display: "12", accept: ["12", "twelve"], explanation: "'Undergraduate students can borrow up to twelve books at a time.' Postgraduates can take twenty." },
  "lt-4": { display: "3", accept: ["3", "three"], explanation: "'The standard loan period is three weeks.'" },
  "lt-5": { display: "first", accept: ["first", "1st"], explanation: "'The first floor is a silent study area.'" },
  "lt-6": { display: "two-hour", accept: ["two-hour", "2-hour"], explanation: "'Rooms are booked online for two-hour periods.'" },
  "lt-7": { display: "6", accept: ["6", "six"], explanation: "'Each room holds up to six people.'" },
  "lt-8": { display: "C", accept: ["C"], explanation: "'The history and politics collections are on level three.'" },
  "lt-9": { display: "B", accept: ["B"], explanation: "'There's no charge… but you'll need to make an appointment at least two days in advance.'" },
  "lt-10": { display: "A", accept: ["A"], explanation: "'The technology desk, which is in the basement.'" },

  // ---- Listening: Community Garden Volunteers ----
  "cg-1": { display: "Thursday", accept: ["Thursday", "Thursdays"], explanation: "'We have a monthly meeting on Thursday evening.'" },
  "cg-2": { display: "6.30", accept: ["6.30", "6:30", "six thirty", "18:30", "18.30"], explanation: "'It starts at six thirty.'" },
  "cg-3": { display: "B", accept: ["B"], explanation: "'It's held in Room B… Not Room D.'" },
  "cg-4": { display: "Saturday", accept: ["Saturday", "Saturdays"], explanation: "'Most of the practical work happens on Saturday mornings.'" },
  "cg-5": { display: "herbs", accept: ["herbs"], explanation: "'We're planting herbs near the south fence.' Fruit trees were the original plan." },
  "cg-6": { display: "benches", accept: ["benches"], explanation: "'Repair the wooden benches beside the entrance.'" },
  "cg-7": { display: "water bottle", accept: ["water bottle"], explanation: "'Please bring your own gloves and a water bottle.'" },
  "cg-8": { display: "5", accept: ["5", "five", "5.00"], explanation: "'Pay five pounds a year towards our insurance.'" },
  "cg-9": { display: "B", accept: ["B"], explanation: "'Most of them go to the local food bank.'" },
  "cg-10": { display: "C", accept: ["C"], explanation: "'The money from that is spent on seeds for next season.'" },
};
