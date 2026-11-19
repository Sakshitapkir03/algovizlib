import type { Pattern, Problem } from "@/lib/catalog";

import { categories } from "./categories";
import { patternGroups } from "./groups";
import { arraysHashingPattern } from "./patterns/arrays-hashing";
import { prefixSumPattern } from "./patterns/prefix-sum";
import { sortingPattern } from "./patterns/sorting";
import { bitManipulationPattern } from "./patterns/bit-manipulation";
import { twoPointersPattern } from "./patterns/two-pointers";
import { fastSlowPointersPattern } from "./patterns/fast-slow-pointers";
import { slidingWindowPattern } from "./patterns/sliding-window";
import { binarySearchPattern } from "./patterns/binary-search";
import { stackPattern } from "./patterns/stack";
import { linkedListPattern } from "./patterns/linked-list";
import { intervalsPattern } from "./patterns/intervals";
import { greedyPattern } from "./patterns/greedy";
import { treesDfsPattern } from "./patterns/trees-dfs";
import { graphsBfsPattern } from "./patterns/graphs-bfs";
import { heapPattern } from "./patterns/heap";
import { triePattern } from "./patterns/trie";
import { advancedGraphsPattern } from "./patterns/advanced-graphs";
import { backtrackingPattern } from "./patterns/backtracking";
import { dynamicProgrammingPattern } from "./patterns/dynamic-programming";
import { designPattern } from "./patterns/design";
import { arraysHashingProblems } from "./problems/arrays-hashing";
import { prefixSumProblems } from "./problems/prefix-sum";
import { sortingProblems } from "./problems/sorting";
import { bitManipulationProblems } from "./problems/bit-manipulation";
import { twoPointersProblems } from "./problems/two-pointers";
import { fastSlowPointersProblems } from "./problems/fast-slow-pointers";
import { slidingWindowProblems } from "./problems/sliding-window";
import { binarySearchProblems } from "./problems/binary-search";
import { stackProblems } from "./problems/stack";
import { linkedListProblems } from "./problems/linked-list";
import { intervalsProblems } from "./problems/intervals";
import { greedyProblems } from "./problems/greedy";
import { treesDfsProblems } from "./problems/trees-dfs";
import { graphsBfsProblems } from "./problems/graphs-bfs";
import { heapProblems } from "./problems/heap";
import { trieProblems } from "./problems/trie";
import { advancedGraphsProblems } from "./problems/advanced-graphs";
import { backtrackingProblems } from "./problems/backtracking";
import { dynamicProgrammingProblems } from "./problems/dynamic-programming";
import { designProblems } from "./problems/design";

/**
 * Raw catalog content. Pages must not import this; they read through `@/lib/catalog/repository`, so the source
 * can move to a database later. To add a pattern, add its file under `patterns/` and its problem folder under
 * `problems/`, then register both here.
 */
export { categories, patternGroups };

// In /dsa order (group, then position); `order` on each pattern is the source of truth.
export const patterns: readonly Pattern[] = [
  arraysHashingPattern,
  prefixSumPattern,
  sortingPattern,
  bitManipulationPattern,
  twoPointersPattern,
  fastSlowPointersPattern,
  slidingWindowPattern,
  binarySearchPattern,
  stackPattern,
  linkedListPattern,
  intervalsPattern,
  greedyPattern,
  treesDfsPattern,
  graphsBfsPattern,
  heapPattern,
  triePattern,
  advancedGraphsPattern,
  backtrackingPattern,
  dynamicProgrammingPattern,
  designPattern,
];

export const problems: readonly Problem[] = [
  ...arraysHashingProblems,
  ...prefixSumProblems,
  ...sortingProblems,
  ...bitManipulationProblems,
  ...twoPointersProblems,
  ...fastSlowPointersProblems,
  ...slidingWindowProblems,
  ...binarySearchProblems,
  ...stackProblems,
  ...linkedListProblems,
  ...intervalsProblems,
  ...greedyProblems,
  ...treesDfsProblems,
  ...graphsBfsProblems,
  ...heapProblems,
  ...trieProblems,
  ...advancedGraphsProblems,
  ...backtrackingProblems,
  ...dynamicProgrammingProblems,
  ...designProblems,
];
