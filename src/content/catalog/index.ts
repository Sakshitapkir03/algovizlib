import type { Pattern, Problem } from "@/lib/catalog";

import { categories } from "./categories";
import { twoPointersPattern } from "./patterns/two-pointers";
import { slidingWindowPattern } from "./patterns/sliding-window";
import { binarySearchPattern } from "./patterns/binary-search";
import { stackPattern } from "./patterns/stack";
import { linkedListPattern } from "./patterns/linked-list";
import { treesDfsPattern } from "./patterns/trees-dfs";
import { graphsBfsPattern } from "./patterns/graphs-bfs";
import { dynamicProgrammingPattern } from "./patterns/dynamic-programming";
import { twoPointersProblems } from "./problems/two-pointers";
import { slidingWindowProblems } from "./problems/sliding-window";
import { binarySearchProblems } from "./problems/binary-search";
import { stackProblems } from "./problems/stack";
import { linkedListProblems } from "./problems/linked-list";
import { treesDfsProblems } from "./problems/trees-dfs";
import { graphsBfsProblems } from "./problems/graphs-bfs";
import { dynamicProgrammingProblems } from "./problems/dynamic-programming";

/**
 * Raw catalog content. Pages must not import this; they read through `@/lib/catalog/repository`, so the source
 * can move to a database later. To add a pattern, add its file under `patterns/` and its problem folder under
 * `problems/`, then register both here.
 */
export { categories };

export const patterns: readonly Pattern[] = [
  twoPointersPattern,
  slidingWindowPattern,
  binarySearchPattern,
  stackPattern,
  linkedListPattern,
  treesDfsPattern,
  graphsBfsPattern,
  dynamicProgrammingPattern,
];

export const problems: readonly Problem[] = [
  ...twoPointersProblems,
  ...slidingWindowProblems,
  ...binarySearchProblems,
  ...stackProblems,
  ...linkedListProblems,
  ...treesDfsProblems,
  ...graphsBfsProblems,
  ...dynamicProgrammingProblems,
];
