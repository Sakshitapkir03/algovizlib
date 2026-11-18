import type { Problem } from "@/lib/catalog";

import { binaryTreeMaximumPathSum } from "./binary-tree-maximum-path-sum";
import { countGoodNodesInBinaryTree } from "./count-good-nodes-in-binary-tree";
import { maximumDepthOfBinaryTree } from "./maximum-depth-of-binary-tree";
import { pathSum } from "./path-sum";
import { validateBinarySearchTree } from "./validate-binary-search-tree";

export const treesDfsProblems: Problem[] = [
  maximumDepthOfBinaryTree,
  pathSum,
  validateBinarySearchTree,
  countGoodNodesInBinaryTree,
  binaryTreeMaximumPathSum,
];
