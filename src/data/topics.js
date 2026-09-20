// Topics in the same order as https://workat.tech/problem-solving/practice/topics/index.html
export const TOPICS = [
  { slug: "arrays", name: "Arrays", csv: "arrays.csv" },
  { slug: "searching", name: "Searching", csv: "searching.csv" },
  { slug: "two-pointers", name: "Two Pointers", csv: "two-pointers.csv" },
  { slug: "linked-lists", name: "Linked Lists", csv: "linked-lists.csv" },
  { slug: "stacks-and-queues", name: "Stacks & Queues", csv: "stacks-and-queues.csv" },
  { slug: "hashing", name: "Hashing", csv: "hashing.csv" },
  { slug: "backtracking", name: "Backtracking", csv: "backtracking.csv" },
  { slug: "binary-trees", name: "Binary Trees", csv: "binary-trees.csv" },
  { slug: "bst-heaps-and-map", name: "BST, Heaps & Map", csv: "bst-heaps-and-map.csv" },
  { slug: "maths-and-bits", name: "Math & Bit Manipulation", csv: "maths-and-bits.csv" },
  { slug: "dynamic-programming", name: "Dynamic Programming", csv: "dynamic-programming.csv" },
  { slug: "greedy-algorithm", name: "Greedy Algorithm", csv: "greedy-algorithm.csv" },
  { slug: "graphs", name: "Graphs", csv: "graphs.csv" },
  { slug: "string-and-tries", name: "String & Tries", csv: "string-and-tries.csv" },
];

export const workatTopicUrl = (slug) =>
  `https://workat.tech/problem-solving/topics/${slug}/practice/index.html`;

export const getTopic = (slug) => TOPICS.find((t) => t.slug === slug);
