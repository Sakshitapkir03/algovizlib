import { bubbleSort } from "./bubble-sort";
import { countInversions } from "./count-inversions";
import { countingSort } from "./counting-sort";
import { heapSort } from "./heap-sort";
import { insertionSort } from "./insertion-sort";
import { mergeSort } from "./merge-sort";
import { quickSort } from "./quick-sort";
import { selectionSort } from "./selection-sort";

export const sortingProblems = [
  bubbleSort,
  selectionSort,
  insertionSort,
  mergeSort,
  quickSort,
  heapSort,
  countingSort,
  countInversions,
];
