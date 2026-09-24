// Topics in the same order as https://workat.tech/problem-solving/practice/topics/index.html
import type { ComponentType } from "react";
import {
  CoinsIcon,
  CpuIcon,
  DatabaseIcon,
  GridIcon,
  HashIcon,
  LayersIcon,
  LinkIcon,
  MoveHorizontalIcon,
  NetworkIcon,
  RotateCcwIcon,
  SearchIcon,
  ShareIcon,
  TableIcon,
  TypeIcon,
} from "../components/icons.jsx";

export interface Topic {
  slug: string;
  name: string;
  csv: string;
  icon: ComponentType<{ className?: string }>;
  chip: string;
}

export const TOPICS: Topic[] = [
  { slug: "arrays", name: "Arrays", csv: "arrays.csv", icon: GridIcon, chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { slug: "searching", name: "Searching", csv: "searching.csv", icon: SearchIcon, chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  { slug: "two-pointers", name: "Two Pointers", csv: "two-pointers.csv", icon: MoveHorizontalIcon, chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { slug: "linked-lists", name: "Linked Lists", csv: "linked-lists.csv", icon: LinkIcon, chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  { slug: "stacks-and-queues", name: "Stacks & Queues", csv: "stacks-and-queues.csv", icon: LayersIcon, chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  { slug: "hashing", name: "Hashing", csv: "hashing.csv", icon: HashIcon, chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  { slug: "backtracking", name: "Backtracking", csv: "backtracking.csv", icon: RotateCcwIcon, chip: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
  { slug: "binary-trees", name: "Binary Trees", csv: "binary-trees.csv", icon: NetworkIcon, chip: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  { slug: "bst-heaps-and-map", name: "BST, Heaps & Map", csv: "bst-heaps-and-map.csv", icon: DatabaseIcon, chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  { slug: "maths-and-bits", name: "Math & Bit Manipulation", csv: "maths-and-bits.csv", icon: CpuIcon, chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  { slug: "dynamic-programming", name: "Dynamic Programming", csv: "dynamic-programming.csv", icon: TableIcon, chip: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  { slug: "greedy-algorithm", name: "Greedy Algorithm", csv: "greedy-algorithm.csv", icon: CoinsIcon, chip: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300" },
  { slug: "graphs", name: "Graphs", csv: "graphs.csv", icon: ShareIcon, chip: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  { slug: "string-and-tries", name: "String & Tries", csv: "string-and-tries.csv", icon: TypeIcon, chip: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300" },
];

export const workatTopicUrl = (slug: string): string =>
  `https://workat.tech/problem-solving/topics/${slug}/practice/index.html`;

export const getTopic = (slug: string): Topic | undefined =>
  TOPICS.find((t) => t.slug === slug);
