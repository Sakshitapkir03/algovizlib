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
    // A linked list's positions are its node ids (a cache's evicted nodes leave gaps).
    const listIds = new Map<string, Set<number>>();
    for (const el of scene.elements) {
      if (el.type === "item-row") rows.set(el.id, el.items.length);
      if (el.type === "bar-row") rows.set(el.id, el.bars.length);
      if (el.type === "linked-list") {
        rows.set(el.id, el.nodes.length);
        listIds.set(el.id, new Set(el.nodes.map((node) => node.id)));
      }
      if (el.type === "binary-tree") rows.set(el.id, el.nodes.length);
    }

    const checkIndex = (rowId: string, idx: number, path: (string | number)[]) => {
      const len = rows.get(rowId);
      const ids = listIds.get(rowId);
      if (len === undefined) {
        ctx.addIssue({ code: "custom", path, message: `Unknown row "${rowId}"` });
      } else if (ids) {
        if (!ids.has(idx)) ctx.addIssue({ code: "custom", path, message: `"${rowId}" has no node ${idx}` });
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
          // Ids are 0…n-1, except that a node removed for good (a cache's eviction) leaves its id unused.
          const known = new Set(ids);
          if (known.size !== n)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "node ids must each appear once",
            });
          const places = el.nodes.map((node) => `${node.lane}:${node.slot}`);
          if (new Set(places).size !== n)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "two nodes share a lane and slot",
            });
          el.nodes.forEach((node, k) => {
            if (node.next !== null && !known.has(node.next))
              ctx.addIssue({
                code: "custom",
                path: [...path, "nodes", k, "next"],
                message: `node ${node.id} links to ${node.next}, which isn't a node`,
              });
            // A doubly linked list's back link must point at the node whose next is this one.
            if (node.prev !== undefined) {
              const before = node.prev === null ? undefined : el.nodes.find((m) => m.id === node.prev);
              const ok =
                node.prev === null
                  ? !el.nodes.some((m) => m.next === node.id && m.lane === node.lane)
                  : before !== undefined && before.next === node.id;
              if (!ok)
                ctx.addIssue({
                  code: "custom",
                  path: [...path, "nodes", k, "prev"],
                  message: `node ${node.id}'s prev (${node.prev}) isn't the node that links to it`,
                });
            }
          });
          el.rewired?.forEach((r, k) => {
            if ([r.node, r.from, r.to].some((id) => id !== null && !known.has(id)))
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
            // Every hop must follow a real link: from → path… → to. A move refused at once stays put (0 hops).
            const stays = move.hops === 0 && move.path.length === 0 && move.to === move.from;
            const stops = stays ? [move.from] : [move.from, ...move.path, move.to];
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
        case "choice":
          if (scene.elements.filter((e) => e.type === "choice").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one choice" });
          break;
        case "reach": {
          const row = scene.elements.find((e) => e.id === el.rowId);
          if (row?.type !== "item-row") {
            ctx.addIssue({
              code: "custom",
              path: [...path, "rowId"],
              message: `A reach covers an item-row in the same scene; there's no item-row "${el.rowId}"`,
            });
            break;
          }
          if (el.to < el.from - 1)
            ctx.addIssue({ code: "custom", path, message: "to must be at least from - 1 (nothing covered)" });
          else if (el.to >= el.from) {
            checkIndex(el.rowId, el.from, [...path, "from"]);
            checkIndex(el.rowId, el.to, [...path, "to"]);
          }
          if (el.jump) {
            checkIndex(el.rowId, el.jump.from, [...path, "jump", "from"]);
            checkIndex(el.rowId, el.jump.to, [...path, "jump", "to"]);
          }
          el.pieces.forEach((piece, k) => {
            checkIndex(el.rowId, piece.to, [...path, "pieces", k, "to"]);
            if (piece.from > piece.to || (k > 0 && piece.from <= el.pieces[k - 1].to))
              ctx.addIssue({
                code: "custom",
                path: [...path, "pieces", k],
                message: "pieces go left to right without overlapping (from ≤ to)",
              });
          });
          if (scene.elements.filter((e) => e.type === "reach").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one reach" });
          break;
        }
        case "prefix-row": {
          const n = rows.get(el.rowId);
          const row = scene.elements.find((e) => e.id === el.rowId);
          if (row?.type !== "item-row" || n === undefined) {
            ctx.addIssue({
              code: "custom",
              path: [...path, "rowId"],
              message: `A prefix-row sits under an item-row in the same scene; there's no item-row "${el.rowId}"`,
            });
            break;
          }
          if (el.values.length !== n + 1) {
            ctx.addIssue({
              code: "custom",
              path: [...path, "values"],
              message: `A prefix-row has one cell per boundary: ${n + 1} for ${n} items (it has ${el.values.length})`,
            });
            break;
          }
          const cells = [
            el.current,
            ...(el.reads ?? []),
            ...(el.spans ?? []).flatMap((sp) => [sp.from, sp.to]),
          ];
          if (cells.some((c) => c !== undefined && c > n))
            ctx.addIssue({ code: "custom", path, message: `cells are 0–${n} (boundaries of ${n} items)` });
          (el.spans ?? []).forEach((sp, k) => {
            if (sp.from > sp.to)
              ctx.addIssue({
                code: "custom",
                path: [...path, "spans", k],
                message: "a span's from must not be after to",
              });
            const [a, b] = [el.values[sp.from], el.values[sp.to]];
            // A sum's span is the difference of its two cells (later minus earlier, for a suffix row earlier minus later).
            if (el.op === "+" && a !== null && b !== null && a !== undefined && b !== undefined) {
              const diff = el.direction === "prefix" ? b - a : a - b;
              if (sp.to > sp.from && diff !== sp.value)
                ctx.addIssue({
                  code: "custom",
                  path: [...path, "spans", k, "value"],
                  message: `the span ${sp.from}–${sp.to} is ${el.direction === "prefix" ? `${b} − ${a}` : `${a} − ${b}`} = ${diff}, not ${sp.value}`,
                });
            }
          });
          const spans = scene.elements.flatMap((e) =>
            e.type === "prefix-row" && e.rowId === el.rowId
              ? (e.spans ?? []).filter((sp) => sp.to > sp.from)
              : [],
          );
          if (spans.some((a, i) => spans.some((b, j) => i < j && a.from < b.to && b.from < a.to)))
            ctx.addIssue({
              code: "custom",
              path,
              message: "spans over one row must not overlap (their brackets share a strip)",
            });
          if (scene.elements.filter((e) => e.type === "prefix-row" && e.rowId === el.rowId).length > 2)
            ctx.addIssue({ code: "custom", path, message: "An item-row has at most two prefix-rows" });
          break;
        }
        case "prefix-grid": {
          const R = el.matrix.length;
          const C = el.matrix[0].length;
          if (el.matrix.some((row) => row.length !== C))
            ctx.addIssue({
              code: "custom",
              path: [...path, "matrix"],
              message: "every matrix row has the same length",
            });
          if (el.prefix.length !== R + 1 || el.prefix.some((row) => row.length !== C + 1))
            ctx.addIssue({
              code: "custom",
              path: [...path, "prefix"],
              message: `the prefix grid is (${R} + 1) × (${C} + 1) for a ${R} × ${C} matrix`,
            });
          const inMatrix = (r: { r1: number; c1: number; r2: number; c2: number }) =>
            r.r1 <= r.r2 && r.c1 <= r.c2 && r.r2 < R && r.c2 < C;
          if (el.rects.some((r) => !inMatrix(r)) || (el.found && !inMatrix(el.found)))
            ctx.addIssue({
              code: "custom",
              path: [...path, "rects"],
              message: `rectangles lie inside the ${R} × ${C} matrix (r1 ≤ r2, c1 ≤ c2)`,
            });
          const inPrefix = ([r, c]: [number, number]) => r <= R && c <= C;
          if ((el.current && !inPrefix(el.current)) || el.marks.some((m) => !inPrefix(m.at)))
            ctx.addIssue({
              code: "custom",
              path: [...path, "marks"],
              message: `prefix cells are 0–${R} × 0–${C}`,
            });
          if (scene.elements.filter((e) => e.type === "prefix-grid").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one prefix-grid" });
          break;
        }
        case "timeline": {
          if (el.max <= el.min)
            ctx.addIssue({ code: "custom", path: [...path, "max"], message: "the axis needs max > min" });
          const ids = el.bars.map((b) => b.id);
          if (new Set(ids).size !== ids.length)
            ctx.addIssue({ code: "custom", path: [...path, "bars"], message: "bar ids must not repeat" });
          el.bars.forEach((b, k) => {
            if (b.start > b.end || b.start < el.min || b.end > el.max)
              ctx.addIssue({
                code: "custom",
                path: [...path, "bars", k],
                message: `bar ${b.id} [${b.start}, ${b.end}] must have start ≤ end and lie on the axis ${el.min}–${el.max}`,
              });
            if (b.lane >= el.lanes || (b.fromLane !== undefined && b.fromLane >= el.lanes))
              ctx.addIssue({
                code: "custom",
                path: [...path, "bars", k, "lane"],
                message: `lanes are 0–${el.lanes - 1}`,
              });
          });
          if (el.grow && !ids.includes(el.grow.id))
            ctx.addIssue({
              code: "custom",
              path: [...path, "grow"],
              message: `bar ${el.grow.id} isn't on the timeline`,
            });
          for (const [field, r] of [
            ["overlap", el.overlap],
            ["grow", el.grow],
          ] as const)
            if (r && (r.start > r.end || r.start < el.min || r.end > el.max))
              ctx.addIssue({
                code: "custom",
                path: [...path, field],
                message: `${field} must lie on the axis with start ≤ end`,
              });
          if (el.sweep && (el.sweep.at < el.min || el.sweep.at > el.max))
            ctx.addIssue({
              code: "custom",
              path: [...path, "sweep"],
              message: "the sweep marker must lie on the axis",
            });
          if (scene.elements.filter((e) => e.type === "timeline").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one timeline" });
          break;
        }
        case "bits": {
          const lo = -(2 ** (el.width - 1));
          const hi = 2 ** el.width - 1;
          el.rows.forEach((row, k) => {
            for (const [field, v] of [
              ["value", row.value],
              ["from", row.from?.value],
            ] as const)
              if (v !== undefined && (v < lo || v > hi))
                ctx.addIssue({
                  code: "custom",
                  path: [...path, "rows", k, field],
                  message: `${v} doesn't fit ${el.width} bits (${lo} to ${hi})`,
                });
            if ((row.changed ?? []).some((b) => b >= el.width))
              ctx.addIssue({
                code: "custom",
                path: [...path, "rows", k, "changed"],
                message: `bit positions are 0–${el.width - 1}`,
              });
          });
          if (el.bitLabels && el.bitLabels.length !== el.width)
            ctx.addIssue({
              code: "custom",
              path: [...path, "bitLabels"],
              message: `one label per bit: ${el.width}`,
            });
          if (scene.elements.filter((e) => e.type === "bits").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one bits panel" });
          break;
        }
        case "trie": {
          const ids = new Set(el.nodes.map((n) => n.id));
          const root = el.nodes[0];
          if (root.id !== 0 || root.parent !== null || ids.size !== el.nodes.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "node 0 is the root (no parent), and ids don't repeat",
            });
          if (el.nodes.some((n) => n.parent !== null && (!ids.has(n.parent) || n.letter.length !== 1)))
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "every other node has one letter and a parent in the trie",
            });
          const siblings = el.nodes.map((n) => `${n.parent}:${n.letter}`);
          if (new Set(siblings).size !== siblings.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "two children of one node can't share a letter",
            });
          const parentOf = new Map(el.nodes.map((n) => [n.id, n.parent]));
          if (
            el.path[0] !== 0 ||
            el.path.some((id, k) => !ids.has(id) || (k > 0 && parentOf.get(id) !== el.path[k - 1]))
          )
            ctx.addIssue({
              code: "custom",
              path: [...path, "path"],
              message: "the path runs from the root, child by child",
            });
          for (const [field, list] of [
            ["created", el.created],
            ["branches", el.branches],
            ["hits", el.hits],
          ] as const)
            if ((list ?? []).some((id) => !ids.has(id)))
              ctx.addIssue({
                code: "custom",
                path: [...path, field],
                message: `${field} must be nodes in the trie`,
              });
          if (
            el.missing &&
            (!ids.has(el.missing.parent) || siblings.includes(`${el.missing.parent}:${el.missing.letter}`))
          )
            ctx.addIssue({
              code: "custom",
              path: [...path, "missing"],
              message: "a missing child's parent is in the trie, and the child really isn't",
            });
          if (scene.elements.filter((e) => e.type === "trie").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one trie" });
          break;
        }
        case "digraph": {
          const ids = new Set(el.nodes.map((n) => n.id));
          if (ids.size !== el.nodes.length)
            ctx.addIssue({ code: "custom", path: [...path, "nodes"], message: "node ids don't repeat" });
          const spots = el.nodes.map((n) => `${n.x},${n.y}`);
          if (new Set(spots).size !== spots.length)
            ctx.addIssue({
              code: "custom",
              path: [...path, "nodes"],
              message: "two nodes can't share a spot",
            });
          const pairs = el.edges.map((e) =>
            el.directed ? `${e.from}>${e.to}` : [e.from, e.to].sort().join("-"),
          );
          if (el.edges.some((e) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to))
            ctx.addIssue({
              code: "custom",
              path: [...path, "edges"],
              message: "every edge joins two different nodes in the graph",
            });
          if (new Set(pairs).size !== pairs.length)
            ctx.addIssue({ code: "custom", path: [...path, "edges"], message: "an edge can't appear twice" });
          if (scene.elements.filter((e) => e.type === "digraph").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one digraph" });
          break;
        }
        case "union-find": {
          const n = el.labels.length;
          const inRange = (i: number) => i < n;
          if (el.parents.length !== n || (el.sizes && el.sizes.length !== n) || !el.parents.every(inRange))
            ctx.addIssue({
              code: "custom",
              path: [...path, "parents"],
              message: "one parent (and size) per element, each an element",
            });
          else {
            // Before this scene's work: the union undone, then the compressed links pointed back.
            const before = [...el.parents];
            if (el.union) before[el.union.child] = el.union.child;
            for (const c of [...(el.compressed ?? [])].reverse()) before[c.node] = c.from;
            const isForest = (parents: number[]) =>
              parents.every((_, i) => {
                let x = i;
                for (let k = 0; k <= n; k++) {
                  if (parents[x] === x) return true;
                  x = parents[x];
                }
                return false;
              });
            if (!isForest(el.parents) || !isForest(before))
              ctx.addIssue({
                code: "custom",
                path: [...path, "parents"],
                message: "parent links can't loop: every chain ends at a root",
              });
            if (
              el.union &&
              (el.parents[el.union.child] !== el.union.parent ||
                el.union.child === el.union.parent ||
                el.parents[el.union.parent] !== el.union.parent)
            )
              ctx.addIssue({
                code: "custom",
                path: [...path, "union"],
                message: "a union points one root at another root",
              });
            if ((el.compressed ?? []).some((c) => !inRange(c.node) || !inRange(c.from) || !inRange(c.to)))
              ctx.addIssue({
                code: "custom",
                path: [...path, "compressed"],
                message: "compressed links join elements",
              });
            // Each find walks the links as the finds before it left them (their compression applied).
            const walk = [...before];
            const pending = [...(el.compressed ?? [])];
            for (const [k, find] of (el.finds ?? []).entries()) {
              if (
                !find.path.every(inRange) ||
                find.path.some((x, j) => j > 0 && walk[find.path[j - 1]] !== x) ||
                walk[find.path.at(-1)!] !== find.path.at(-1)
              )
                ctx.addIssue({
                  code: "custom",
                  path: [...path, "finds", k, "path"],
                  message: "a find follows parent links up to a root",
                });
              while (pending.length && find.path.includes(pending[0].node))
                walk[pending[0].node] = pending.shift()!.to;
            }
            if (el.same !== undefined && (!inRange(el.same) || el.parents[el.same] !== el.same))
              ctx.addIssue({ code: "custom", path: [...path, "same"], message: "the shared root is a root" });
          }
          if (scene.elements.filter((e) => e.type === "union-find").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one union-find" });
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
          // One stack, or two when one shows the step's second stack (a queue made of two stacks).
          if (
            scene.elements.filter(
              (e) => e.type === "stack" && (e.traceStack ?? "first") === (el.traceStack ?? "first"),
            ).length > 1
          )
            ctx.addIssue({
              code: "custom",
              path,
              message: 'A scene can show only one stack (a second one needs traceStack: "second")',
            });
          break;
        case "op-log": {
          const n = el.calls.length;
          if (el.shown > n)
            ctx.addIssue({
              code: "custom",
              path: [...path, "shown"],
              message: `shown can't exceed the ${n} calls`,
            });
          if (el.current !== undefined) {
            if (el.current >= n)
              ctx.addIssue({
                code: "custom",
                path: [...path, "current"],
                message: `current is out of range (${n} calls)`,
              });
            // Every earlier call has its output; the current one has it once it returns.
            else if (el.shown !== el.current && el.shown !== el.current + 1)
              ctx.addIssue({
                code: "custom",
                path: [...path, "shown"],
                message: "shown must be the current call (before it returns) or the one after it",
              });
          }
          if (scene.elements.filter((e) => e.type === "op-log").length > 1)
            ctx.addIssue({ code: "custom", path, message: "A scene can show only one op-log" });
          break;
        }
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
        case "system-diagram": {
          const ids = new Set(el.nodes.map((n) => n.id));
          if (ids.size !== el.nodes.length)
            ctx.addIssue({ code: "custom", path: [...path, "nodes"], message: "Node ids must be unique" });
          el.edges.forEach((e, k) => {
            if (!ids.has(e.from) || !ids.has(e.to))
              ctx.addIssue({
                code: "custom",
                path: [...path, "edges", k],
                message: `Edge ${e.from} → ${e.to} names a node the diagram doesn't have`,
              });
          });
          el.tokens.forEach((tok, k) => {
            const linked = el.edges.some(
              (e) => (e.from === tok.from && e.to === tok.to) || (e.from === tok.to && e.to === tok.from),
            );
            if (!linked)
              ctx.addIssue({
                code: "custom",
                path: [...path, "tokens", k],
                message: `Token "${tok.label}" travels ${tok.from} → ${tok.to}, which isn't an edge`,
              });
          });
          break;
        }
        case "sequence": {
          const lanes = new Set(el.lanes.map((l) => l.id));
          const rowIds = new Set<string>();
          el.rows.forEach((row, k) => {
            if (rowIds.has(row.id))
              ctx.addIssue({
                code: "custom",
                path: [...path, "rows", k],
                message: `Duplicate row id "${row.id}"`,
              });
            rowIds.add(row.id);
            const ends = row.kind === "message" ? [row.from, row.to] : [row.lane];
            if (ends.some((id) => !lanes.has(id)))
              ctx.addIssue({
                code: "custom",
                path: [...path, "rows", k],
                message: `Row "${row.id}" names a lane the sequence doesn't have`,
              });
          });
          if (el.current !== undefined && !rowIds.has(el.current))
            ctx.addIssue({
              code: "custom",
              path: [...path, "current"],
              message: `current "${el.current}" isn't one of the rows`,
            });
          break;
        }
        case "data-table":
        case "metrics": {
          const drawn = el.type === "data-table" ? el.tables : el.items;
          if (new Set(el.show).size !== el.show.length)
            ctx.addIssue({ code: "custom", path: [...path, "show"], message: "show lists an id twice" });
          if (drawn.map((d) => d.id).join("|") !== el.show.join("|"))
            ctx.addIssue({
              code: "custom",
              path: [...path, el.type === "data-table" ? "tables" : "items"],
              message: `The ${el.type} must draw exactly what show lists, in order (${el.show.join(", ")})`,
            });
          break;
        }
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
