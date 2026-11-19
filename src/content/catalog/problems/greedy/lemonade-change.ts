import { defineProblem } from "@/lib/catalog";

export const lemonadeChange = defineProblem({
  slug: "lemonade-change",
  patternSlug: "greedy",
  title: "Lemonade Change",
  difficulty: "easy",
  order: 0,
  statement: `You run a lemonade stand where every cup costs \`$5\`. Customers arrive one at a time in the order given by \`bills\`, and each one buys exactly one cup and pays with a single \`$5\`, \`$10\`, or \`$20\` bill. You start the day with no money in the till, and you can only give change using bills customers have already paid you.

Return \`true\` if you can hand every customer the correct change, and \`false\` as soon as any customer can't be given exact change.`,
  examples: [
    {
      input: "bills = [5, 5, 10, 5, 20]",
      output: "true",
      explanation:
        "The $10 customer gets one $5 back. When the $20 arrives you hold one $5 and one $10, so you return $10 + $5.",
      args: [[5, 5, 10, 5, 20]],
      expected: true,
    },
    {
      input: "bills = [5, 10, 10, 20]",
      output: "false",
      explanation: "The first $10 uses up your only $5, so the second $10 customer can't get change.",
      args: [[5, 10, 10, 20]],
      expected: false,
    },
    {
      input: "bills = [10]",
      output: "false",
      explanation: "The till is empty, so the very first customer can't get $5 back.",
      args: [[10]],
      expected: false,
    },
  ],
  constraints: ["1 ≤ bills.length ≤ 10⁵", "bills[i] is 5, 10, or 20"],
  hints: [
    "You never need to remember $20 bills: they can't be used as change for anything.",
    "Track how many $5 and $10 bills you hold. For $15 of change there are two ways to pay it. Which one keeps you more flexible?",
    "For a $20, give a $10 and a $5 if you have a $10; only otherwise give three $5s. A $5 can make change for anyone, a $10 can't, so spend the $10 first.",
  ],
  keyIdea:
    "Count your $5 and $10 bills. A $5 needs nothing; a $10 needs one $5; a $20 needs $15, and you should pay it with a $10 plus a $5 when possible, because $5 bills are the only ones that can serve a future $10 customer. If the needed bills aren't there, return false.",
  complexity: { time: "O(n)", space: "O(1)" },
  tags: ["array", "simulation"],
  externalRefs: [{ label: "LeetCode 860", url: "https://leetcode.com/problems/lemonade-change/" }],
});
