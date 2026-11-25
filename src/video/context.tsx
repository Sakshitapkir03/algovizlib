import { createContext, useContext } from "react";

import type { Element } from "@/lib/storyboard";

import type {
  DpLayout,
  GraphLayout,
  GridLayout,
  HeapPanel,
  ListLayout,
  PileLayout,
  SearchLayout,
  Region,
  RowLayout,
  StackLayout,
  TreeLayout,
} from "./layout";
import type { TextMetrics } from "./text";
import type { TrieShape } from "./trie-layout";
import type { ForestShape } from "./forest-layout";
import type { NetworkShape } from "./network-layout";
import type { OpLogShape } from "./oplog-layout";
import type { SequenceShape, SystemShape } from "./system-layout";
import type { VideoPalette } from "./theme";

export type SceneContextValue = {
  rows: Record<string, RowLayout>;
  /** Every element in the scene (for labels that make room for their neighbors). */
  elements: readonly Element[];
  /** Top of the bottom stack (see `layoutScene`). */
  bottomTop: number;
  heapRegion: Region;
  /** A linked-list's lanes and slots, when the scene has one. */
  list?: ListLayout;
  /** A binary tree's and a call stack's geometry, when the scene has them. */
  tree?: TreeLayout;
  stack?: StackLayout;
  /** A BFS grid's or graph's geometry, when the scene has one. */
  grid?: GridLayout;
  graph?: GraphLayout;
  /** A "heap" element's panels, when the scene has one. */
  heapPanels?: HeapPanel[];
  /** A dp-table's geometry (and the story region above a 1D one), when the scene has one. */
  dp?: DpLayout;
  /** A stack's column (and the room under its input row), when the scene has one. */
  pile?: PileLayout;
  /** Per stack element, when a scene has two stacks or an op log (`pile` is then the first). */
  piles?: Record<string, PileLayout>;
  /** A design problem's op log column, when the scene has one. */
  opLog?: OpLogShape;
  /** A search tree's node positions, when the scene has one. */
  search?: SearchLayout;
  /** A trie's node positions, when the scene has one. */
  trie?: TrieShape;
  /** A digraph's node and edge geometry, when the scene has one. */
  network?: NetworkShape;
  /** A union-find's trees (before and after the scene's work), when the scene has one. */
  forest?: ForestShape;
  /** A system design scene's diagram or sequence view, when it has one. */
  system?: SystemShape;
  sequence?: SequenceShape;
  palette: VideoPalette;
  reducedMotion: boolean;
  sceneDurationInFrames: number;
  /** Font sizes for the player's rendered width (see `video/text.ts`). */
  text: TextMetrics;
};

export const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene(): SceneContextValue {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be used inside a <SceneView>");
  return ctx;
}
