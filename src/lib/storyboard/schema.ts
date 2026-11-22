import { z } from "zod";

import { elementSchema, elementSourceSchema } from "./elements";

const nonEmpty = z.string().trim().min(1);

/**
 * How the storyboard grounds the concept in the real world. See the
 * "Choosing the example" section of CLAUDE.md.
 * - "problem-native": the problem statement is already a real-world scenario;
 *   use its exact wording and numbers.
 * - "analogy": the problem is abstract; use a relatable analogy and map it
 *   back to the abstract problem in the closing scene.
 */
export const exampleSourceSchema = z.enum(["problem-native", "analogy"]);

export const analogySchema = z.object({
  /** One-sentence description of the real-world story. */
  scenario: nonEmpty,
  /** How each part of the story maps to the abstract problem. */
  mapping: z.array(z.object({ real: nonEmpty, abstract: nonEmpty })).min(1),
});

/**
 * Binds a storyboard to a deterministic trace (src/lib/traces) run on `args`, so every pointer, equation, and
 * highlight can be derived from and checked against the algorithm's real moves.
 */
export const traceBindingSchema = z.object({
  /** "pattern/slug" of a problem in the trace registry. */
  problem: nonEmpty,
  /** Positional arguments, the same shape as a catalog example's `args`. */
  args: z.array(z.unknown()),
});

/** Provenance of a generated storyboard. Hand-written storyboards omit it. */
export const generationMetaSchema = z.object({
  promptVersion: nonEmpty,
  provider: nonEmpty,
  model: nonEmpty,
  generatedAt: nonEmpty,
  repairAttempts: z.number().int().nonnegative(),
});

export const takeawaySchema = z.object({
  pattern: nonEmpty,
  summary: nonEmpty,
  timeComplexity: nonEmpty,
  spaceComplexity: nonEmpty,
  whenToUse: z.array(nonEmpty).default([]),
});

const sceneShape = {
  id: nonEmpty,
  /** Text to be voiced (ElevenLabs via `pnpm generate:narration`, or the browser's voice). */
  narration: nonEmpty,
  /** Short on-screen text. */
  caption: nonEmpty.max(80),
  /** Estimated from the narration, or set from the stitched track's offsets when the video has `narrationTrack`. */
  durationInFrames: z.number().int().min(45),
  /** Index of the trace step this scene shows. Bound pointers, equations, and highlights follow that step. */
  traceStep: z.number().int().nonnegative().optional(),
};

type SceneLike = { id: string; elements: readonly { id: string }[] };

function checkUniqueElementIds(scene: SceneLike, ctx: z.RefinementCtx) {
  const ids = new Set<string>();
  scene.elements.forEach((el, i) => {
    if (ids.has(el.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["elements", i, "id"],
        message: `Duplicate element id "${el.id}" in scene "${scene.id}"`,
      });
    }
    ids.add(el.id);
  });
}

export const sceneSchema = z
  .object({ ...sceneShape, elements: z.array(elementSchema) })
  .superRefine((scene, ctx) => {
    checkUniqueElementIds(scene, ctx);
    const rows = new Map<string, number>();
    for (const el of scene.elements) {
      if (el.type === "item-row") rows.set(el.id, el.items.length);
      if (el.type === "bar-row") rows.set(el.id, el.bars.length);
      if (el.type === "linked-list") rows.set(el.id, el.nodes.length);
      if (el.type === "binary-tree") rows.set(el.id, el.nodes.length);
    }

    const checkIndex = (rowId: string, idx: number, path: (string | number)[]) => {
      const len = rows.get(rowId);
      if (len === undefined) {
        ctx.addIssue({ code: "custom", path, message: `Unknown row "${rowId}"` });
      } else if (idx >= len) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `Index ${idx} is out of range for "${rowId}" (${len} items)`,
        });
      }
    };

    scene.elements.forEach((el, i) => {
      const path = ["elements", i];
      switch (el.type) {
        case "pointer":
          checkIndex(el.rowId, el.index, [...path, "index"]);
          if (el.fromIndex !== undefined) checkIndex(el.rowId, el.fromIndex, [...path, "fromIndex"]);
          break;
        case "highlight":
          el.indices.forEach((idx) => checkIndex(el.rowId, idx, [...path, "indices"]));
          break;
        case "callout":
          if (el.anchor) checkIndex(el.anchor.rowId, el.anchor.index, [...path, "anchor"]);
          break;
        case "bar-row":
          if (el.fill) {
            checkIndex(el.id, el.fill.from, [...path, "fill", "from"]);
            checkIndex(el.id, el.fill.to, [...path, "fill", "to"]);
          }
          el.moves?.forEach((m, k) => {
            checkIndex(el.id, m.from, [...path, "moves", k, "from"]);
            checkIndex(el.id, m.to, [...path, "moves", k, "to"]);
          });
          el.empty?.forEach((idx) => checkIndex(el.id, idx, [...path, "empty"]));
          if (el.water && el.water.length !== el.bars.length) {
            ctx.addIssue({
              code: "custom",
              path: [...path, "water"],
              message: `water has ${el.water.length} entries but there are ${el.bars.length} bars`,
            });
          }
          break;
        case "sorted-region":
          el.indices.forEach((idx) => checkIndex(el.rowId, idx, [...path, "indices"]));
          if (new Set(el.indices).size !== el.indices.length)
            ctx.addIssue({ code: "custom", path: [...path, "indices"], message: "indices must not repeat" });
          break;
        case "held-value":
          checkIndex(el.rowId, el.index, [...path, "index"]);
          break;
        case "count-array":
          if (el.keys.length !== el.counts.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "counts"],
              message: `counts has ${el.counts.length} entries but there are ${el.keys.length} keys`,
            });
          if (el.active !== undefined && el.active >= el.keys.length)
            ctx.addIssue({ code: "custom", path: [...path, "active"], message: "active is out of range" });
          if (scene.elements.filter((e) => e.type === "count-array").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one count-array" });
          break;
        case "segments": {
          let next = 0;
          el.groups.forEach((g, k) => {
            checkIndex(el.rowId, g.to, [...path, "groups", k, "to"]);
            if (g.from !== next || g.from > g.to)
              ctx.addIssue({
                code: "custom",
                path: [...path, "groups", k],
                message: "groups must be in order, without gaps or overlaps, each with from ≤ to",
              });
            next = g.to + 1;
          });
          if (rows.get(el.rowId) !== undefined && next !== rows.get(el.rowId))
            ctx.addIssue({
              code: "custom",
              path: [...path, "groups"],
              message: "groups must cover the whole row",
            });
          if (el.active) {
            checkIndex(el.rowId, el.active.to, [...path, "active", "to"]);
            if (el.active.from > el.active.to)
              ctx.addIssue({
                code: "custom",
                path: [...path, "active"],
                message: "from must not be after to",
              });
          }
          break;
        }
        case "merge-buffer":
          checkIndex(el.rowId, el.from + el.values.length - 1, [...path, "values"]);
          if (el.taken !== undefined && el.taken >= el.values.length)
            ctx.addIssue({ code: "custom", path: [...path, "taken"], message: "taken is out of range" });
          break;
        case "partition":
          checkIndex(el.rowId, el.pivot, [...path, "pivot"]);
          checkIndex(el.rowId, el.to, [...path, "to"]);
          if (
            el.from > el.to ||
            el.boundary < el.from ||
            el.boundary > el.to ||
            el.pivot < el.from ||
            el.pivot > el.to
          )
            ctx.addIssue({
              code: "custom",
              path,
              message: "from ≤ boundary ≤ to and from ≤ pivot ≤ to must hold",
            });
          break;
        case "heap-tree": {
          const n = el.values.length;
          if (el.heapSize > n)
            ctx.addIssue({
              code: "custom",
              path: [...path, "heapSize"],
              message: `heapSize is more than ${n}`,
            });
          if (
            el.compare &&
            (el.compare[0] >= n ||
              el.compare[1] >= n ||
              el.compare[1] < 2 * el.compare[0] + 1 ||
              el.compare[1] > 2 * el.compare[0] + 2)
          )
            ctx.addIssue({
              code: "custom",
              path: [...path, "compare"],
              message: "compare must be a parent and one of its children, both in range",
            });
          if (el.moves?.some((m) => m.from >= n || m.to >= n))
            ctx.addIssue({ code: "custom", path: [...path, "moves"], message: "moves are out of range" });
          if (scene.elements.filter((e) => e.type === "heap-tree").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one heap-tree" });
          break;
        }
        case "split-tree":
          if (scene.elements.filter((e) => e.type === "split-tree").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one split-tree" });
          break;
        case "window":
          for (const [range, at] of [
            [el, path],
            [el.fromRange, [...path, "fromRange"]],
          ] as [{ from: number; to: number } | undefined, (string | number)[]][]) {
            if (!range) continue;
            if (range.to < range.from - 1)
              ctx.addIssue({ code: "custom", path: at, message: "to must be at least from - 1 (empty)" });
            else if (range.to >= range.from) {
              checkIndex(el.rowId, range.from, [...at, "from"]);
              checkIndex(el.rowId, range.to, [...at, "to"]);
            } else if (!rows.has(el.rowId))
              ctx.addIssue({ code: "custom", path: at, message: `Unknown row "${el.rowId}"` });
          }
          break;
        case "freq-table": {
          const keys = el.entries.map((e) => e.key);
          if (new Set(keys).size !== keys.length)
            ctx.addIssue({ code: "custom", path: [...path, "entries"], message: "keys must not repeat" });
          if (el.active !== undefined && !keys.includes(el.active))
            ctx.addIssue({
              code: "custom",
              path: [...path, "active"],
              message: "active must be one of the keys",
            });
          if (scene.elements.filter((e) => e.type === "freq-table").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one freq-table" });
          break;
        }
        case "deque":
          for (const field of ["indices", "poppedBack", "poppedFront"] as const)
            el[field]?.forEach((idx) => checkIndex(el.rowId, idx, [...path, field]));
          if (new Set(el.indices).size !== el.indices.length)
            ctx.addIssue({ code: "custom", path: [...path, "indices"], message: "indices must not repeat" });
          if (scene.elements.filter((e) => e.type === "deque").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one deque" });
          break;
        case "search-range":
          for (const [range, at] of [
            [el, path],
            [el.fromRange, [...path, "fromRange"]],
          ] as [{ from: number; to: number } | undefined, (string | number)[]][]) {
            if (!range) continue;
            if (range.to < range.from - 1)
              ctx.addIssue({ code: "custom", path: at, message: "to must be at least from - 1 (empty)" });
            else if (range.to >= range.from) {
              checkIndex(el.rowId, range.from, [...at, "from"]);
              checkIndex(el.rowId, range.to, [...at, "to"]);
            } else if (rows.has(el.rowId) && range.from > rows.get(el.rowId)!)
              ctx.addIssue({
                code: "custom",
                path: at,
                message: "an empty range must sit at or before the end",
              });
            else if (!rows.has(el.rowId))
              ctx.addIssue({ code: "custom", path: at, message: `Unknown row "${el.rowId}"` });
          }
          if (el.mid !== undefined) checkIndex(el.rowId, el.mid, [...path, "mid"]);
          if (el.sorted) {
            checkIndex(el.rowId, el.sorted.to, [...path, "sorted", "to"]);
            if (el.sorted.from > el.sorted.to)
              ctx.addIssue({
                code: "custom",
                path: [...path, "sorted"],
                message: "from must not be after to",
              });
          }
          break;
        case "number-line":
          if (el.max < el.min || el.max - el.min > 15)
            ctx.addIssue({
              code: "custom",
              path: [...path, "max"],
              message: "a number line shows 1–16 candidates (min ≤ max ≤ min + 15)",
            });
          if (!(el.min <= el.low && el.low <= el.high && el.high <= el.max))
            ctx.addIssue({
              code: "custom",
              path: [...path, "low"],
              message: "min ≤ low ≤ high ≤ max must hold",
            });
          if (el.mid !== undefined && (el.mid < el.min || el.mid > el.max))
            ctx.addIssue({
              code: "custom",
              path: [...path, "mid"],
              message: "mid must be between min and max",
            });
          if (scene.elements.filter((e) => e.type === "number-line").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one number-line" });
          break;
        case "linked-list": {
          const n = el.nodes.length;
          const ids = el.nodes.map((node) => node.id);
          if (new Set(ids).size !== n || ids.some((id) => id >= n))
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: `node ids must be 0–${n - 1}, each once`,
            });
          const places = el.nodes.map((node) => `${node.lane}:${node.slot}`);
          if (new Set(places).size !== n)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "two nodes share a lane and slot",
            });
          el.nodes.forEach((node, k) => {
            if (node.next !== null && node.next >= n)
              ctx.addIssue({
                code: "custom",
                path: [...path, "nodes", k, "next"],
                message: `node ${node.id} links to ${node.next}, which isn't a node`,
              });
          });
          el.rewired?.forEach((r, k) => {
            if ([r.node, r.from, r.to].some((id) => id !== null && id >= n))
              ctx.addIssue({
                code: "custom",
                path: [...path, "rewired", k],
                message: "rewired refers to a missing node",
              });
          });
          if (scene.elements.filter((e) => e.type === "linked-list").length > 1)
            ctx.addIssue({
              code: "custom",
              path,
              message: "A scene can show only one linked-list (use lanes for more lists)",
            });
          break;
        }
        case "binary-tree": {
          const n = el.nodes.length;
          const ids = el.nodes.map((node) => node.id);
          if (new Set(ids).size !== n || ids.some((id) => id >= n))
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: `node ids must be 0–${n - 1}, each once`,
            });
          const children = el.nodes.flatMap((node) => [node.left, node.right]).filter((c) => c !== null);
          if (children.some((c) => c >= n || c === 0) || new Set(children).size !== children.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "every node but the root (0) must be exactly one node's child",
            });
          const refs: [string, number | undefined][] = [
            ["current", el.current],
            ["nullVisit", el.nullVisit?.parent],
            ["returned", el.returned?.to],
            ...el.path.map((id) => ["path", id] as [string, number]),
            ...el.done.map((id) => ["done", id] as [string, number]),
            ...(el.skipped ?? []).map((id) => ["skipped", id] as [string, number]),
            ...(el.results ?? []).map((r) => ["results", r.node] as [string, number]),
            ...(el.badges ?? []).map((b) => ["badges", b.node] as [string, number]),
          ];
          for (const [field, id] of refs)
            if (id !== undefined && id >= n)
              ctx.addIssue({
                code: "custom",
                path: [...path, field],
                message: `${field} refers to node ${id}, which isn't in the tree`,
              });
          const byId = new Map(el.nodes.map((node) => [node.id, node]));
          if (el.nullVisit && byId.get(el.nullVisit.parent)?.[el.nullVisit.side] !== null)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nullVisit"],
              message: `node ${el.nullVisit.parent} has a ${el.nullVisit.side} child, so that call isn't on a missing one`,
            });
          if (scene.elements.filter((e) => e.type === "binary-tree").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one binary-tree" });
          break;
        }
        case "grid":
        case "graph": {
          const n = el.type === "grid" ? el.rows * el.cols : el.nodes.length;
          if (el.type === "grid") {
            if (el.cells.length !== el.rows || el.cells.some((row) => row.length !== el.cols))
              ctx.addIssue({
                code: "custom",
                path: [...path, "cells"],
                message: `cells must be ${el.rows} rows of ${el.cols}`,
              });
            const known = new Set(el.legend.map((k) => String(k.value)));
            if (el.cells.flat().some((v) => !known.has(String(v))))
              ctx.addIssue({
                code: "custom",
                path: [...path, "legend"],
                message: "every cell value needs a legend entry",
              });
          } else {
            if (el.nodes.some((node, k) => node.id !== k))
              ctx.addIssue({
                code: "custom",
                path: [...path, "nodes"],
                message: "node ids must be 0, 1, 2, … in order",
              });
            if (el.edges.some(([a, b]) => a >= n || b >= n || a === b))
              ctx.addIssue({
                code: "custom",
                path: [...path, "edges"],
                message: "an edge joins two different nodes",
              });
          }
          const ids = [
            el.current,
            ...el.visited,
            ...el.frontier,
            ...(el.levels ?? []).map((l) => l.id),
            ...(el.checks ?? []).flatMap((ch) => [ch.from, ch.to]),
          ];
          if (ids.some((id) => id !== undefined && id >= n))
            ctx.addIssue({
              code: "custom",
              path,
              message: `the search refers to an item outside the ${el.type} (0–${n - 1})`,
            });
          if (el.type === "grid" && (el.checks ?? []).some((ch) => !ch.dir))
            ctx.addIssue({ code: "custom", path: [...path, "checks"], message: "a grid's checks need dir" });
          if (scene.elements.filter((e) => e.type === el.type).length > 1)
            ctx.addIssue({ code: "custom", path, message: `A scene can show only one ${el.type}` });
          break;
        }
        case "race": {
          const list = scene.elements.find((e) => e.type === "linked-list" && e.id === el.rowId);
          if (!list || list.type !== "linked-list") {
            ctx.addIssue({
              code: "custom",
              path: [...path, "rowId"],
              message: `A race runs on a linked-list in the same scene; there's no linked-list "${el.rowId}"`,
            });
            break;
          }
          const next = new Map(list.nodes.map((node) => [node.id, node.next]));
          const has = (id: number) => next.has(id);
          el.moves.forEach((move, k) => {
            // Every hop must follow a real link: from → path… → to.
            const stops = [move.from, ...move.path, move.to];
            const follows = stops.every((id, j) => j === 0 || next.get(stops[j - 1] as number) === id);
            if (
              !has(move.from) ||
              move.path.some((id) => !has(id)) ||
              !follows ||
              move.hops !== stops.length - 1
            )
              ctx.addIssue({
                code: "custom",
                path: [...path, "moves", k],
                message: `${move.pointer}'s move doesn't follow the list's links (${stops.map((id) => id ?? "null").join(" → ")}, ${move.hops} hops)`,
              });
            if (move.blocked !== undefined && (move.to === null || next.get(move.to) !== move.blocked))
              ctx.addIssue({
                code: "custom",
                path: [...path, "moves", k, "blocked"],
                message: `${move.pointer} can only be refused the node its last stop links to`,
              });
          });
          for (const [field, id] of [
            ["meet", el.meet],
            ["entry", el.entry],
          ] as const)
            if (id !== undefined && !has(id))
              ctx.addIssue({
                code: "custom",
                path: [...path, field],
                message: `node ${id} isn't in the list`,
              });
          if (el.loop && next.get(el.loop.from) !== el.loop.to)
            ctx.addIssue({
              code: "custom",
              path: [...path, "loop"],
              message: `the loop's link ${el.loop.from} → ${el.loop.to} isn't in the list`,
            });
          if (scene.elements.filter((e) => e.type === "race").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one race" });
          break;
        }
        case "hash-map": {
          const keys = el.entries.map((e) => e.key);
          if (new Set(keys).size !== keys.length)
            ctx.addIssue({ code: "custom", path: [...path, "entries"], message: "each key appears once" });
          if (el.kind === "set" && el.entries.some((e) => e.value !== undefined))
            ctx.addIssue({
              code: "custom",
              path: [...path, "entries"],
              message: "a set's entries have no values",
            });
          for (const [field, key] of [
            ["inserted", el.inserted],
            ["updated", el.updated?.key],
          ] as const)
            if (key !== undefined && !keys.includes(key))
              ctx.addIssue({ code: "custom", path: [...path, field], message: `"${key}" isn't in the map` });
          if (el.lookup && keys.includes(el.lookup.key) !== el.lookup.found && el.inserted !== el.lookup.key)
            ctx.addIssue({
              code: "custom",
              path: [...path, "lookup"],
              message: `the lookup for "${el.lookup.key}" says ${el.lookup.found ? "found" : "not found"}, but the map ${keys.includes(el.lookup.key) ? "has" : "doesn't have"} it`,
            });
          if (scene.elements.filter((e) => e.type === "hash-map").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one hash-map" });
          break;
        }
        case "search-tree": {
          const n = el.nodes.length;
          if (el.nodes.some((node, k) => node.id !== k) || el.nodes[0]?.parent !== null)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "node ids must be 0, 1, 2, … with node 0 the root",
            });
          if (el.nodes.some((node) => node.parent !== null && node.parent >= node.id))
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "a node's parent must come before it",
            });
          const ids = [
            ...el.reached,
            ...el.path,
            ...el.dead,
            ...el.solutions,
            ...(el.collapsed ?? []),
            el.current,
            el.undone,
          ];
          if (ids.some((id) => id !== undefined && id >= n))
            ctx.addIssue({
              code: "custom",
              path,
              message: `the search refers to a node outside the tree (0–${n - 1})`,
            });
          if (
            el.path.some((id, k) => k > 0 && el.nodes[id]?.parent !== el.path[k - 1]) ||
            (el.path.length && el.path[0] !== 0)
          )
            ctx.addIssue({
              code: "custom",
              path: [...path, "path"],
              message: "the path must run from the root, parent to child",
            });
          if (scene.elements.filter((e) => e.type === "search-tree").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one search-tree" });
          break;
        }
        case "stack":
          if (el.rowId) {
            for (const [k, link] of (el.links ?? []).entries()) {
              checkIndex(el.rowId, link.from, [...path, "links", k, "from"]);
              checkIndex(el.rowId, link.to, [...path, "links", k, "to"]);
            }
            for (const [k, a] of (el.answers ?? []).entries())
              checkIndex(el.rowId, a.index, [...path, "answers", k]);
          } else if (el.links?.length || el.answers?.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "rowId"],
              message: "links and answers need the input row's id",
            });
          if (el.pushed !== undefined && el.pushed > el.items.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "pushed"],
              message: "pushed can't exceed the items",
            });
          if (scene.elements.filter((e) => e.type === "stack").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one stack" });
          break;
        case "dp-table": {
          if (el.cells.length !== el.rows || el.cells.some((row) => row.length !== el.cols))
            ctx.addIssue({
              code: "custom",
              path: [...path, "cells"],
              message: `cells must be ${el.rows} rows of ${el.cols}`,
            });
          const inside = ([r, c]: [number, number]) => r < el.rows && c < el.cols;
          const at = [el.current, el.answer, ...(el.reads ?? []).map((read) => read.at)];
          if (at.some((p) => p !== undefined && !inside(p)))
            ctx.addIssue({
              code: "custom",
              path,
              message: `a cell reference is outside the ${el.rows}×${el.cols} table`,
            });
          if ((el.chosen ?? []).some((k) => k >= (el.reads ?? []).length))
            ctx.addIssue({
              code: "custom",
              path: [...path, "chosen"],
              message: "chosen refers to a read that isn't listed",
            });
          if (el.rowHeaders && el.rowHeaders.length !== el.rows)
            ctx.addIssue({
              code: "custom",
              path: [...path, "rowHeaders"],
              message: "one row header per row",
            });
          if (el.colHeaders && el.colHeaders.length !== el.cols)
            ctx.addIssue({
              code: "custom",
              path: [...path, "colHeaders"],
              message: "one column header per column",
            });
          if (scene.elements.filter((e) => e.type === "dp-table").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one dp-table" });
          break;
        }
        case "staircase":
          if (
            (el.at !== undefined && el.at >= el.steps) ||
            (el.hops ?? []).some((h) => h.from >= el.steps || h.to >= el.steps)
          )
            ctx.addIssue({ code: "custom", path, message: `the staircase has steps 0–${el.steps - 1}` });
          break;
        case "house-row": {
          const n = el.money.length;
          if ([el.current, ...el.taken, ...el.skipped].some((i) => i !== undefined && i >= n))
            ctx.addIssue({ code: "custom", path, message: `the street has houses 0–${n - 1}` });
          if (el.taken.some((i) => el.taken.includes(i + 1)))
            ctx.addIssue({
              code: "custom",
              path: [...path, "taken"],
              message: "two neighboring houses can't both be taken",
            });
          break;
        }
        case "heap":
          el.heaps.forEach((heap, h) => {
            if ((heap.swaps ?? []).some(([a, b]) => a >= heap.items.length || b >= heap.items.length))
              ctx.addIssue({
                code: "custom",
                path: [...path, "heaps", h, "swaps"],
                message: "a swap refers to a position past the heap's end",
              });
            // A push may take it one over capacity for a moment; the next step pops it back.
            if (heap.capacity !== undefined && heap.items.length > heap.capacity + 1)
              ctx.addIssue({
                code: "custom",
                path: [...path, "heaps", h, "items"],
                message: `the heap holds ${heap.items.length}, more than one over its capacity of ${heap.capacity}`,
              });
            const slots = el.slots?.[h];
            if (slots !== undefined && slots < heap.items.length + (heap.popped ? 1 : 0))
              ctx.addIssue({
                code: "custom",
                path: [...path, "slots"],
                message: "slots must cover every item",
              });
          });
          if (scene.elements.filter((e) => e.type === "heap").length > 1)
            ctx.addIssue({
              code: "custom",
              path,
              message: "A scene can show only one heap element (it holds up to two heaps)",
            });
          break;
        case "queue":
          if (scene.elements.filter((e) => e.type === "queue").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one queue" });
          if ((el.enqueued ?? []).some((id) => !el.items.some((item) => item.id === id)))
            ctx.addIssue({
              code: "custom",
              path: [...path, "enqueued"],
              message: "every enqueued id must be in items",
            });
          break;
        case "call-stack":
          if (scene.elements.filter((e) => e.type === "call-stack").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one call-stack" });
          if (el.kept !== undefined && el.kept > el.frames.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "kept"],
              message: `kept (${el.kept}) can't exceed the ${el.frames.length} frames`,
            });
          break;
        case "cut":
          for (const field of ["at", "fromAt"] as const) {
            const at = el[field];
            if (at === undefined) continue;
            const len = rows.get(el.rowId);
            if (len === undefined)
              ctx.addIssue({ code: "custom", path: [...path, field], message: `Unknown row "${el.rowId}"` });
            else if (at > len)
              ctx.addIssue({
                code: "custom",
                path: [...path, field],
                message: `A cut in "${el.rowId}" can be at most ${len} (after the last item)`,
              });
          }
          break;
        default:
          break;
      }
    });
  });

/** Authoring form: trace-derived values may be omitted (see `resolveStoryboard`). */
export const sceneSourceSchema = z
  .object({ ...sceneShape, elements: z.array(elementSourceSchema) })
  .superRefine(checkUniqueElementIds);

const storyboardShape = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id must be kebab-case"),
  title: nonEmpty,
  /** The CS concept being taught, e.g. "Two Pointers". */
  concept: nonEmpty,
  category: z.enum(["dsa", "system-design"]),
  /** One-line hook used on cards and in metadata. */
  summary: nonEmpty,
  exampleSource: exampleSourceSchema,
  analogy: analogySchema.optional(),
  tags: z.array(nonEmpty).default([]),
  takeaway: takeawaySchema,
  trace: traceBindingSchema.optional(),
  generation: generationMetaSchema.optional(),
  /**
   * The whole video's voiced narration as one track, attached by `withNarration()` from the narration manifest (never
   * written in storyboard files). `sceneStartsMs[i]` is where scene i's speech starts; scene lengths follow it.
   */
  narrationTrack: z
    .object({
      src: z.string().min(1),
      durationMs: z.number().positive(),
      sceneStartsMs: z.array(z.number().nonnegative()),
    })
    .optional(),
};

type StoryboardLike = {
  exampleSource: z.infer<typeof exampleSourceSchema>;
  analogy?: unknown;
  scenes: readonly { id: string }[];
};

function checkStoryboard(sb: StoryboardLike, ctx: z.RefinementCtx) {
  if (sb.exampleSource === "analogy" && !sb.analogy) {
    ctx.addIssue({
      code: "custom",
      path: ["analogy"],
      message: 'exampleSource "analogy" requires an analogy description',
    });
  }
  if (sb.exampleSource === "problem-native" && sb.analogy) {
    ctx.addIssue({
      code: "custom",
      path: ["analogy"],
      message: 'exampleSource "problem-native" must use the problem\'s own scenario, not an analogy',
    });
  }
  const sceneIds = new Set<string>();
  sb.scenes.forEach((scene, i) => {
    if (sceneIds.has(scene.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["scenes", i, "id"],
        message: `Duplicate scene id "${scene.id}"`,
      });
    }
    sceneIds.add(scene.id);
  });
}

export const storyboardSchema = z
  .object({ ...storyboardShape, scenes: z.array(sceneSchema).min(1) })
  .superRefine(checkStoryboard);

export const storyboardSourceSchema = z
  .object({ ...storyboardShape, scenes: z.array(sceneSourceSchema).min(1) })
  .superRefine(checkStoryboard);

export type ExampleSource = z.infer<typeof exampleSourceSchema>;
export type Analogy = z.infer<typeof analogySchema>;
export type TraceBinding = z.infer<typeof traceBindingSchema>;
export type GenerationMeta = z.infer<typeof generationMetaSchema>;
export type Takeaway = z.infer<typeof takeawaySchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type StoryboardSource = z.infer<typeof storyboardSourceSchema>;
export type SceneSource = z.infer<typeof sceneSourceSchema>;
/** Authoring shape: defaults (enterAt, unit, placement…) and trace-derived values may be omitted. */
export type StoryboardInput = z.input<typeof storyboardSourceSchema>;
export type SceneInput = z.input<typeof sceneSourceSchema>;
