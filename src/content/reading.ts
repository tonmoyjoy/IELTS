import type { ReadingSet } from "@/content/types";
import { TFNG_OPTIONS, YNNG_OPTIONS, letterOptions, paragraphOptions } from "@/content/options";

export const readingSets: ReadingSet[] = [
  {
    id: "urban-green-spaces",
    title: "Urban Green Spaces",
    summary: "Why cities now treat parks and trees as infrastructure, and who benefits.",
    recommendedMinutes: 20,
    passage: {
      heading: "Green infrastructure in the modern city",
      paragraphs: [
        {
          label: "A",
          text: "For much of the twentieth century, parks and tree-lined streets were treated by city governments as decorative extras: pleasant to have, but the first item to be cut when budgets tightened. That view has changed considerably. Planners now increasingly describe green spaces as essential infrastructure, comparable to roads or drainage systems, because of the measurable services they provide to residents.",
        },
        {
          label: "B",
          text: "The most widely studied of these services is cooling. Dense urban areas absorb heat during the day and release it slowly at night, producing what is known as the urban heat island effect. Trees reduce this effect in two ways: their canopies shade pavements and buildings, and the water they release through their leaves cools the surrounding air. One study of forty European cities found that neighbourhoods with substantial tree cover were, on average, up to four degrees cooler on summer afternoons than nearby districts with little vegetation.",
        },
        {
          label: "C",
          text: "Green spaces also help cities manage water. When rain falls on concrete, it runs straight into drains, which can overflow during heavy storms. Soil and plant roots, by contrast, absorb a large share of rainfall and release it gradually. For this reason, several cities have replaced sections of paved car parks with planted areas known as rain gardens, which are designed to collect run-off from surrounding roofs and roads.",
        },
        {
          label: "D",
          text: "The benefits for health are harder to measure but no less important. Researchers have linked regular access to parks with lower levels of stress and higher levels of physical activity. However, the evidence suggests that the quality of a space matters more than its size: a small, well-maintained park with seating, lighting and paths tends to be used far more than a large field with no facilities.",
        },
        {
          label: "E",
          text: "A persistent problem is that these benefits are not distributed equally. In many cities, wealthier districts enjoy more shade and safer, better-maintained parks, while lower-income neighbourhoods may have fewer outdoor areas, and those they do have are often poorly looked after. Critics argue that this pattern turns a public good into a privilege.",
        },
        {
          label: "F",
          text: "To address this imbalance, planners are combining several sources of information to decide where new green spaces should be created first. Satellite data reveals which streets have the least tree cover and the highest surface temperatures, while public health records show where conditions such as asthma are most common. Community surveys complete the picture by identifying what residents themselves want, whether that is a playground, a sports area or simply more trees. Some planners warn, though, that new parks can raise local property prices, pushing out the very residents they were intended to help.",
        },
      ],
    },
    groups: [
      {
        range: "Questions 1–5",
        instructions:
          "Do the following statements agree with the information given in the passage? Choose TRUE if the statement agrees with the information, FALSE if it contradicts the information, or NOT GIVEN if there is no information on this.",
        questions: [
          { id: "ugs-1", number: 1, kind: "choice", options: TFNG_OPTIONS, prompt: "In the twentieth century, city governments often reduced spending on parks first when money was short." },
          { id: "ugs-2", number: 2, kind: "choice", options: TFNG_OPTIONS, prompt: "Trees cool cities only by providing shade." },
          { id: "ugs-3", number: 3, kind: "choice", options: TFNG_OPTIONS, prompt: "The study of forty European cities was carried out over a ten-year period." },
          { id: "ugs-4", number: 4, kind: "choice", options: TFNG_OPTIONS, prompt: "Large parks without facilities are generally used more than small, well-equipped parks." },
          { id: "ugs-5", number: 5, kind: "choice", options: TFNG_OPTIONS, prompt: "Most residents who completed community surveys asked for more playgrounds." },
        ],
      },
      {
        range: "Questions 6–9",
        instructions: "Which paragraph contains the following information? Choose the correct letter, A–F.",
        questions: [
          { id: "ugs-6", number: 6, kind: "choice", options: paragraphOptions(6), prompt: "a possible negative side effect of creating new parks" },
          { id: "ugs-7", number: 7, kind: "choice", options: paragraphOptions(6), prompt: "an example of replacing hard surfaces to deal with rainfall" },
          { id: "ugs-8", number: 8, kind: "choice", options: paragraphOptions(6), prompt: "a comparison between green spaces and other public systems" },
          { id: "ugs-9", number: 9, kind: "choice", options: paragraphOptions(6), prompt: "an explanation of why cities stay warm at night" },
        ],
      },
      {
        range: "Questions 10–12",
        instructions: "Complete the sentences below. Choose ONE WORD ONLY from the passage for each answer.",
        questions: [
          { id: "ugs-10", number: 10, kind: "text", maxWords: 1, allowNumber: false, prompt: "Neighbourhoods with plenty of trees could be up to four degrees cooler on summer ____." },
          { id: "ugs-11", number: 11, kind: "text", maxWords: 1, allowNumber: false, prompt: "Planted areas built to collect run-off are known as rain ____." },
          { id: "ugs-12", number: 12, kind: "text", maxWords: 1, allowNumber: false, prompt: "Public health records show where illnesses such as ____ are most common." },
        ],
      },
    ],
  },
  {
    id: "hybrid-office",
    title: "The Hybrid Office",
    summary: "What remote work changed, what it cost, and how offices are adapting.",
    recommendedMinutes: 20,
    passage: {
      heading: "Working from home, working from the office",
      paragraphs: [
        {
          label: "A",
          text: "When large numbers of office employees were first asked to work from home, many managers expected productivity to fall. In practice, the results were mixed. Workers in knowledge-based roles, such as software development, accounting and editing, often reported that they could concentrate better without the interruptions of an open-plan office. Others, particularly those sharing small homes with family members, found the opposite.",
        },
        {
          label: "B",
          text: "Supporters of remote work point first to the time it saves. A typical commute in a large city can take more than an hour each way, and removing it gives employees time for exercise, family or simply rest. Employers have also discovered that they can recruit from a much wider area when staff do not need to live within travelling distance of an office.",
        },
        {
          label: "C",
          text: "The disadvantages are less obvious but, in my view, more serious. Much of what employees learn at work is learned informally: by overhearing how a colleague handles a difficult client, or by asking a quick question at someone's desk. These moments are difficult to recreate on video calls. Junior staff appear to suffer most, since they have the most to learn and the fewest established relationships. Several firms have noticed that new graduates who started their careers remotely were slower to be promoted.",
        },
        {
          label: "D",
          text: "As a result, many organisations have adopted hybrid policies. Under a typical arrangement, employees attend the office on two or three fixed days each week for meetings, training and collaborative tasks, while independent work that requires concentration is done at home. The success of these policies seems to depend on coordination: if team members come in on different days, the office simply becomes a place to hold video calls with colleagues who are at home.",
        },
        {
          label: "E",
          text: "Office design is changing in response. Rows of identical desks are being replaced by meeting rooms, quiet booths and shared tables, and some companies have reduced their floor space by as much as a third. It is too early to say whether this new model will last, but it seems unlikely that office work will ever return completely to its earlier form.",
        },
      ],
    },
    groups: [
      {
        range: "Questions 1–4",
        instructions:
          "Do the following statements agree with the views of the writer? Choose YES if the statement agrees with the views of the writer, NO if it contradicts the views of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.",
        questions: [
          { id: "hyb-1", number: 1, kind: "choice", options: YNNG_OPTIONS, prompt: "The drawbacks of remote work are more serious than its advantages." },
          { id: "hyb-2", number: 2, kind: "choice", options: YNNG_OPTIONS, prompt: "Video calls can easily replace the informal learning that happens in an office." },
          { id: "hyb-3", number: 3, kind: "choice", options: YNNG_OPTIONS, prompt: "Remote workers should be paid more than office-based staff." },
          { id: "hyb-4", number: 4, kind: "choice", options: YNNG_OPTIONS, prompt: "Office work is likely to return fully to the way it was before." },
        ],
      },
      {
        range: "Questions 5–7",
        instructions: "Choose the correct letter, A, B, C or D.",
        questions: [
          {
            id: "hyb-5",
            number: 5,
            kind: "choice",
            prompt: "According to paragraph A, which workers were more likely to find working from home difficult?",
            options: letterOptions(["software developers", "people sharing small homes with family", "accountants", "managers"]),
          },
          {
            id: "hyb-6",
            number: 6,
            kind: "choice",
            prompt: "Which advantage for employers is mentioned in paragraph B?",
            options: letterOptions(["lower salary costs", "fewer sick days", "access to staff from a wider area", "faster promotion of staff"]),
          },
          {
            id: "hyb-7",
            number: 7,
            kind: "choice",
            prompt: "Which group appears to be most disadvantaged by remote work?",
            options: letterOptions(["senior managers", "junior staff", "editors", "recruiters"]),
          },
        ],
      },
      {
        range: "Questions 8–12",
        instructions: "Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
        questions: [
          { id: "hyb-8", number: 8, kind: "text", maxWords: 2, allowNumber: false, prompt: "Under hybrid policies, staff usually come to the office on two or three ____ each week." },
          { id: "hyb-9", number: 9, kind: "text", maxWords: 2, allowNumber: false, prompt: "Independent work that requires ____ is usually done at home." },
          { id: "hyb-10", number: 10, kind: "text", maxWords: 2, allowNumber: false, prompt: "If colleagues attend on different days, the office becomes a place to hold ____." },
          { id: "hyb-11", number: 11, kind: "text", maxWords: 2, allowNumber: false, prompt: "New office layouts include meeting rooms, quiet ____ and shared tables." },
          { id: "hyb-12", number: 12, kind: "text", maxWords: 2, allowNumber: false, prompt: "Some companies have reduced their floor space by as much as a ____." },
        ],
      },
    ],
  },
  {
    id: "food-waste",
    title: "The Cost of Food Waste",
    summary: "Where food is lost between farm and plate, and which solutions work.",
    recommendedMinutes: 20,
    passage: {
      heading: "From farm to bin",
      paragraphs: [
        {
          label: "A",
          text: "Estimates suggest that roughly a third of all food produced for people to eat is lost or wasted somewhere between the farm and the plate. In lower-income countries, most of this loss happens early in the supply chain, when crops are damaged during harvest or spoil because farmers lack cool storage. In wealthier countries, the largest share is wasted at the end of the chain, in shops and households.",
        },
        {
          label: "B",
          text: "Retailers contribute in several ways. Supermarkets often overstock perishable goods such as bread, fruit and salad because empty shelves are thought to discourage customers. Strict appearance standards also play a part: vegetables that are misshapen or the wrong size may be rejected by buyers before they ever reach a store, even though they are perfectly safe to eat.",
        },
        {
          label: "C",
          text: "Households, however, are responsible for the single largest share of waste in many wealthy countries. Shoppers buy more than they need, store food incorrectly, or throw items away because they misunderstand date labels. A 'best before' date refers only to quality, meaning that food is usually still safe after it has passed, whereas a 'use by' date relates to safety and should be followed carefully.",
        },
        {
          label: "D",
          text: "The environmental cost is considerable. Producing food that is never eaten uses land, water and energy for no benefit, and when that food is sent to landfill it releases methane, a greenhouse gas far more powerful than carbon dioxide over a short period. Composting is better than landfill, but it still wastes the resources that went into growing, transporting and packaging the food.",
        },
        {
          label: "E",
          text: "Solutions range from technology to education. Food-sharing apps allow shops and neighbours to give away surplus items before they spoil, and some supermarkets now sell imperfect vegetables at a discount. Several countries have banned large stores from throwing away edible food, requiring them to donate it to charities instead. Yet most experts agree that prevention is more effective than any method of disposal: the best way to reduce waste is not to produce or buy unnecessary food in the first place.",
        },
      ],
    },
    groups: [
      {
        range: "Questions 1–4",
        instructions:
          "Do the following statements agree with the information given in the passage? Choose TRUE, FALSE or NOT GIVEN.",
        questions: [
          { id: "fw-1", number: 1, kind: "choice", options: TFNG_OPTIONS, prompt: "In lower-income countries, most food is wasted by households." },
          { id: "fw-2", number: 2, kind: "choice", options: TFNG_OPTIONS, prompt: "Supermarkets overstock some foods because they believe empty shelves put customers off." },
          { id: "fw-3", number: 3, kind: "choice", options: TFNG_OPTIONS, prompt: "Misshapen vegetables contain fewer nutrients than standard ones." },
          { id: "fw-4", number: 4, kind: "choice", options: TFNG_OPTIONS, prompt: "Food is usually unsafe to eat once its 'best before' date has passed." },
        ],
      },
      {
        range: "Questions 5–8",
        instructions: "Complete the notes below. Choose ONE WORD ONLY from the passage for each answer.",
        questions: [
          { id: "fw-5", number: 5, kind: "text", maxWords: 1, allowNumber: false, prompt: "Early losses: crops spoil when farmers lack cool ____." },
          { id: "fw-6", number: 6, kind: "text", maxWords: 1, allowNumber: false, prompt: "'Use by' dates relate to ____." },
          { id: "fw-7", number: 7, kind: "text", maxWords: 1, allowNumber: false, prompt: "Food sent to landfill releases ____." },
          { id: "fw-8", number: 8, kind: "text", maxWords: 1, allowNumber: false, prompt: "Some supermarkets sell imperfect vegetables at a ____." },
        ],
      },
      {
        range: "Questions 9–10",
        instructions: "Choose the correct letter, A, B, C or D.",
        questions: [
          {
            id: "fw-9",
            number: 9,
            kind: "choice",
            prompt: "What does the writer say about composting?",
            options: letterOptions([
              "It is worse for the environment than landfill.",
              "It uses no additional resources.",
              "It is preferable to landfill but still wasteful.",
              "It has been banned in several countries.",
            ]),
          },
          {
            id: "fw-10",
            number: 10,
            kind: "choice",
            prompt: "What have several countries required large stores to do?",
            options: letterOptions([
              "sell perishable food at lower prices",
              "donate edible food to charities",
              "compost all of their waste",
              "stop selling bread, fruit and salad",
            ]),
          },
        ],
      },
      {
        range: "Questions 11–12",
        instructions: "Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
        questions: [
          { id: "fw-11", number: 11, kind: "text", maxWords: 2, allowNumber: false, prompt: "Roughly a ____ of food produced for people is lost or wasted." },
          { id: "fw-12", number: 12, kind: "text", maxWords: 2, allowNumber: false, prompt: "Shops and neighbours can use food-sharing ____ to give away surplus items." },
        ],
      },
    ],
  },
];

export function getReadingSet(id: string): ReadingSet | undefined {
  return readingSets.find((set) => set.id === id);
}
