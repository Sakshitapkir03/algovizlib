import { climbingStairsTrace } from "./dynamic-programming/climbing-stairs";
import { coinChangeTrace } from "./dynamic-programming/coin-change";
import { editDistanceTrace } from "./dynamic-programming/edit-distance";
import { houseRobberTrace } from "./dynamic-programming/house-robber";
import { longestCommonSubsequenceTrace } from "./dynamic-programming/longest-common-subsequence";
import { floodFillTrace } from "./graphs-bfs/flood-fill";
import { numberOfIslandsTrace } from "./graphs-bfs/number-of-islands";
import { rottingOrangesTrace } from "./graphs-bfs/rotting-oranges";
import { shortestPathInBinaryMatrixTrace } from "./graphs-bfs/shortest-path-in-binary-matrix";
import { wordLadderTrace } from "./graphs-bfs/word-ladder";
import { findMedianFromDataStreamTrace } from "./heap/find-median-from-data-stream";
import { kClosestPointsToOriginTrace } from "./heap/k-closest-points-to-origin";
import { kthLargestElementInAnArrayTrace } from "./heap/kth-largest-element-in-an-array";
import { lastStoneWeightTrace } from "./heap/last-stone-weight";
import { topKFrequentElementsTrace } from "./heap/top-k-frequent-elements";
import { kokoEatingBananasTrace } from "./binary-search/koko-eating-bananas";
import { medianOfTwoSortedArraysTrace } from "./binary-search/median-of-two-sorted-arrays";
import { searchInRotatedSortedArrayTrace } from "./binary-search/search-in-rotated-sorted-array";
import { searchInsertPositionTrace } from "./binary-search/search-insert-position";
import { searchSortedArrayTrace } from "./binary-search/search-sorted-array";
import { mergeKSortedListsTrace } from "./linked-list/merge-k-sorted-lists";
import { mergeTwoSortedListsTrace } from "./linked-list/merge-two-sorted-lists";
import { removeNthNodeFromEndTrace } from "./linked-list/remove-nth-node-from-end";
import { reorderListTrace } from "./linked-list/reorder-list";
import { reverseLinkedListTrace } from "./linked-list/reverse-linked-list";
import { longestRepeatingCharacterReplacementTrace } from "./sliding-window/longest-repeating-character-replacement";
import { longestSubstringWithoutRepeatingCharactersTrace } from "./sliding-window/longest-substring-without-repeating-characters";
import { maximumSumSubarrayOfSizeKTrace } from "./sliding-window/maximum-sum-subarray-of-size-k";
import { minimumWindowSubstringTrace } from "./sliding-window/minimum-window-substring";
import { slidingWindowMaximumTrace } from "./sliding-window/sliding-window-maximum";
import { bubbleSortTrace } from "./sorting/bubble-sort";
import { countInversionsTrace } from "./sorting/count-inversions";
import { countingSortTrace } from "./sorting/counting-sort";
import { heapSortTrace } from "./sorting/heap-sort";
import { insertionSortTrace } from "./sorting/insertion-sort";
import { mergeSortTrace } from "./sorting/merge-sort";
import { quickSortTrace } from "./sorting/quick-sort";
import { selectionSortTrace } from "./sorting/selection-sort";
import { containerWithMostWaterTrace } from "./two-pointers/container-with-most-water";
import { pairWithTargetSumTrace } from "./two-pointers/pair-with-target-sum";
import { threeSumTrace } from "./two-pointers/three-sum";
import { trappingRainWaterTrace } from "./two-pointers/trapping-rain-water";
import { validPalindromeTrace } from "./two-pointers/valid-palindrome";
import { binaryTreeMaximumPathSumTrace } from "./trees-dfs/binary-tree-maximum-path-sum";
import { countGoodNodesInBinaryTreeTrace } from "./trees-dfs/count-good-nodes-in-binary-tree";
import { maximumDepthOfBinaryTreeTrace } from "./trees-dfs/maximum-depth-of-binary-tree";
import { pathSumTrace } from "./trees-dfs/path-sum";
import { validateBinarySearchTreeTrace } from "./trees-dfs/validate-binary-search-tree";
import type { Trace, TraceDefinition } from "./types";

export * from "./types";

/**
 * Every problem that can be animated, keyed by "pattern/slug". A problem becomes generatable by adding its trace
 * here (see "How to make a problem generatable" in CLAUDE.md).
 */
const definitions = [
  pairWithTargetSumTrace,
  validPalindromeTrace,
  containerWithMostWaterTrace,
  threeSumTrace,
  trappingRainWaterTrace,
  bubbleSortTrace,
  selectionSortTrace,
  insertionSortTrace,
  countingSortTrace,
  mergeSortTrace,
  quickSortTrace,
  heapSortTrace,
  countInversionsTrace,
  maximumSumSubarrayOfSizeKTrace,
  longestSubstringWithoutRepeatingCharactersTrace,
  longestRepeatingCharacterReplacementTrace,
  minimumWindowSubstringTrace,
  slidingWindowMaximumTrace,
  searchSortedArrayTrace,
  searchInsertPositionTrace,
  searchInRotatedSortedArrayTrace,
  kokoEatingBananasTrace,
  medianOfTwoSortedArraysTrace,
  reverseLinkedListTrace,
  mergeTwoSortedListsTrace,
  removeNthNodeFromEndTrace,
  reorderListTrace,
  mergeKSortedListsTrace,
  maximumDepthOfBinaryTreeTrace,
  pathSumTrace,
  countGoodNodesInBinaryTreeTrace,
  validateBinarySearchTreeTrace,
  binaryTreeMaximumPathSumTrace,
  floodFillTrace,
  numberOfIslandsTrace,
  rottingOrangesTrace,
  shortestPathInBinaryMatrixTrace,
  wordLadderTrace,
  lastStoneWeightTrace,
  kthLargestElementInAnArrayTrace,
  topKFrequentElementsTrace,
  kClosestPointsToOriginTrace,
  findMedianFromDataStreamTrace,
  climbingStairsTrace,
  houseRobberTrace,
  coinChangeTrace,
  longestCommonSubsequenceTrace,
  editDistanceTrace,
] as const;

// Each definition is typed with its own argument tuple; the registry erases that behind `runTrace`, which
// validates args first.
type AnyTraceDefinition = Omit<TraceDefinition, "run" | "args"> & {
  args: TraceDefinition["args"];
  run: (...args: never[]) => Trace;
};

export const traceRegistry: Readonly<Record<string, AnyTraceDefinition>> = Object.fromEntries(
  definitions.map((d) => [d.problem, d as unknown as AnyTraceDefinition]),
);

export function getTraceDefinition(problem: string): AnyTraceDefinition | undefined {
  return traceRegistry[problem];
}

/** Run a problem's trace on positional JSON args. Throws a readable error on unknown problems or bad args. */
export function runTrace(problem: string, args: unknown[]): Trace {
  const def = getTraceDefinition(problem);
  if (!def) throw new Error(`No trace is registered for "${problem}"`);
  const parsed = def.args.safeParse(args);
  if (!parsed.success) {
    throw new Error(
      `Invalid args for "${problem}": ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`,
    );
  }
  return def.run(...(parsed.data as never[]));
}
