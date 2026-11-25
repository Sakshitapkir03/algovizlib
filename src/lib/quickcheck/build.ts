import type { Element, Scene, Storyboard } from "@/lib/storyboard";
import type { Trace, TraceStep } from "@/lib/traces/types";

import { pointerSubject } from "@/lib/tutor/suggestions";

import {
  DECISION_OPTIONS,
  FETCH_OPTIONS,
  MAX_CHECKS,
  p99Trend,
  P99_OPTIONS,
  HIT_OPTIONS,
  READ_ROUTE_OPTIONS,
  SATURATION_OPTIONS,
  SET_OPTIONS,
  WRITE_OUTCOME_OPTIONS,
  SERVER_NAMES,
  type QuickCheck,
  type QuickCheckClaim,
} from "./schema";

/**
 * Quick checks for a video, from its trace (no model): at most three, each asked just before a key step's scene, about
 * what that step is about to do. Every option is a name or value the viewer can see (pointer labels as drawn, card
 * values, the equation's numbers, heap and queue labels), and every wrong option comes from the same step (the other
 * pointer, the other comparison results, the other items in the heap). A scene gets one question, from the first of
 * the kinds below that applies; a video with no step any kind fits gets none.
 *
 * The scene before the question must exist (it's what's on screen while the question is asked), so the first scene
 * never gets one. Questions are spread evenly over the scenes that have one.
 */
export function buildQuickChecks(storyboard: Pick<Storyboard, "scenes">, trace: Trace): QuickCheck[] {
  const candidates: QuickCheck[] = [];
  storyboard.scenes.forEach((scene, i) => {
    if (i === 0 || scene.traceStep === undefined) return;
    const step = trace.steps[scene.traceStep];
    if (!step?.key) return;
    const before = storyboard.scenes[i - 1];
    const ctx: Ctx = {
      trace,
      scene,
      index: scene.traceStep,
      step,
      prior: scene.traceStep > 0 ? trace.steps[scene.traceStep - 1] : undefined,
      shownStep: before.traceStep,
      elements: scene.elements,
      scenes: storyboard.scenes,
    };
    for (const kind of KINDS) {
      const made = kind(ctx);
      if (made) {
        candidates.push({
          id: `check-${scene.id}`,
          sceneId: scene.id,
          step: scene.traceStep,
          explanation: step.note,
          ...made,
        });
        break;
      }
    }
  });
  return spread(candidates, MAX_CHECKS);
}

type Ctx = {
  trace: Trace;
  scene: Scene;
  /** The bound step's index. */
  index: number;
  step: TraceStep;
  /** The step just before it in the trace (the state the step starts from). */
  prior?: TraceStep;
  /** The step the previous scene shows, if it's bound. */
  shownStep?: number;
  /** The question's scene's elements (its labels are the ones the viewer knows). */
  elements: readonly Element[];
  /** Every scene of the video (for the verdict words it uses). */
  scenes: readonly Scene[];
};
type Made = Pick<QuickCheck, "prompt" | "options" | "answer" | "claim">;

/** `count` items spread evenly over `list`, keeping order (all of them when there are few). */
function spread<T>(list: readonly T[], count: number): T[] {
  if (list.length <= count) return [...list];
  return Array.from({ length: count }, (_, k) => list[Math.round(((k + 0.5) * list.length) / count - 0.5)]);
}

/** A stable order for options that have no natural one, so the answer isn't always first. */
function arrange(options: string[], correct: string, seed: string): Made["options"] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rest = options.filter((o) => o !== correct);
  const at = h % (rest.length + 1);
  return [...rest.slice(0, at), correct, ...rest.slice(at)];
}

const made = (
  prompt: string,
  options: string[],
  correct: string,
  claim: QuickCheckClaim,
): Made | undefined => {
  const unique = [...new Set(options)];
  const answer = unique.indexOf(correct);
  if (answer === -1 || unique.length < 2 || unique.some((o) => o.length > 40) || prompt.length > 140)
    return undefined;
  return { prompt, options: unique, answer, claim };
};

const YES_NO = ["Yes", "No"];
const OP: Record<"+" | "-" | "×" | "÷", string> = { "+": "+", "-": "−", "×": "×", "÷": "÷" };
export const EXPLORE_OPTIONS = ["Go deeper", "Record an answer", "Cut the branch"] as const;

export const COMPARE_OPTIONS = (target: number) => [
  `Less than ${target}`,
  `Equal to ${target}`,
  `Greater than ${target}`,
];

/** Integer-looking strings: options for "what value" questions are numbers near the answer. */
const isInt = (s: string) => /^-?\d+$/.test(s);
const near = (value: number, others: readonly number[], count: number): number[] => {
  const picks = [...new Set(others.filter((v) => v !== value))];
  for (const d of [1, -1, 2, -2, 3]) if (picks.length < count) picks.push(value + d);
  return [...new Set(picks.filter((v) => v !== value))].slice(0, count);
};
const numeric = (values: number[]) => [...values].sort((a, b) => a - b).map(String);

/** Every verdict word the video's equations use, with the comparison results it's used for. */
function verdictWords(scenes: readonly Scene[], trace: Trace): Map<string, Set<string>> {
  const words = new Map<string, Set<string>>();
  for (const scene of scenes) {
    const eq = scene.elements.find((e) => e.type === "equation");
    const op =
      scene.traceStep === undefined ? undefined : trace.steps[scene.traceStep]?.equation?.comparison?.op;
    if (eq?.type !== "equation" || !eq.verdict || !op) continue;
    words.set(eq.verdict, (words.get(eq.verdict) ?? new Set()).add(op));
  }
  return words;
}

const pointersIn = (elements: readonly Element[]) =>
  elements.flatMap((e) => (e.type === "pointer" && e.binds ? [{ label: e.label, binds: e.binds }] : []));

/** Every version ("v49") a scene's step shows in its tables. */
const shownVersions = (step: TraceStep) =>
  (step.sim?.tables ?? []).flatMap((t) => t.rows.map((r) => r.cells[0])).filter((c) => /^v\d+$/.test(c));

const KINDS: ((ctx: Ctx) => Made | undefined)[] = [
  // A cache stampede. A deploy asks whether its keys expire together; a miss under single-flight asks fetch or wait;
  // a duplicate miss without it asks how many fetches of the key the database now has.
  ({ step, scene }) => {
    const st = step.sim?.stampede;
    if (!st || !scene.elements.some((x) => x.type === "sequence" || x.type === "data-table"))
      return undefined;
    if (st.event === "deploy" && st.expires?.length && st.expires.length > 1) {
      const together = new Set(st.expires.map((x) => x.at)).size === 1;
      return made(
        "The deploy has just filled every key. Do these keys expire together?",
        YES_NO,
        together ? "Yes" : "No",
        {
          kind: "expire-together",
        },
      );
    }
    if (st.event !== "miss" || !st.request || !st.key || st.action === undefined) return undefined;
    if (st.singleFlight && st.action === "wait")
      return made(
        `${st.request} misses ${st.key} while another request fetches it. Does ${st.request} query the database or wait?`,
        Object.values(FETCH_OPTIONS),
        FETCH_OPTIONS[st.action],
        { kind: "fetch-or-wait" },
      );
    if (!st.singleFlight && st.action === "fetch" && (st.inflightAll ?? 0) > 0) {
      const n = (st.inflightAll ?? 0) + 1;
      return made(
        `${st.request} misses ${st.key} too. How many fetches of ${st.key} is the database handling now?`,
        numeric([n - 1, n, n + 1].filter((x) => x >= 1)),
        String(n),
        { kind: "db-count" },
      );
    }
    return undefined;
  },
  // Cache-aside. A read that hits a stale entry asks hit or miss; the last replay's first fresh read asks the price;
  // a versioned store asks whether it's kept.
  ({ step, scene, trace, index }) => {
    const c = step.sim?.cacheOp;
    if (!c || !scene.elements.some((x) => x.type === "sequence" || x.type === "data-table")) return undefined;
    if (c.op === "set" && c.versioned && c.outcome && c.price !== undefined)
      return made(
        `${c.actor}'s page stores $${c.price} (v${c.version}). Is it stored or kept out?`,
        Object.values(SET_OPTIONS),
        SET_OPTIONS[c.outcome],
        { kind: "set-kept" },
      );
    if (c.op !== "get" || c.price === undefined) return undefined;
    const stale = c.version !== undefined && c.version < c.db.version;
    if (c.hit && stale)
      return made(`${c.actor} reloads the page. Hit or miss?`, Object.values(HIT_OPTIONS), HIT_OPTIONS.hit, {
        kind: "cache-hit",
      });
    const lastRun = Math.max(...trace.steps.map((s) => (s.sim?.cacheOp ? s.sim.run : -1)));
    const firstRead = !trace.steps
      .slice(0, index)
      .some(
        (s) => s.sim?.run === step.sim!.run && s.sim.cacheOp?.op === "get" && s.sim.cacheOp.actor === c.actor,
      );
    if (!stale && step.sim!.run === lastRun && firstRead) {
      const prices = [
        ...new Set([c.price, c.db.price, ...(c.entryBefore ? [c.entryBefore.price] : []), 49, 39]),
      ]
        .slice(0, 2)
        .sort((a, b) => b - a)
        .map((p) => `$${p}`);
      return made(`${c.actor} reloads the page. Which price does this read return?`, prices, `$${c.price}`, {
        kind: "read-price",
      });
    }
    return undefined;
  },
  // Concurrent edits. A blind write that overwrites an edit asks the stock after it; a compare-and-set write that's
  // rejected asks whether it applies; a retry that applies asks which version it expects.
  ({ step, scene, trace }) => {
    const e = step.sim?.edit;
    if (
      !e ||
      e.op !== "write" ||
      !scene.elements.some((x) => x.type === "sequence" || x.type === "data-table")
    )
      return undefined;
    if (!e.cas && e.overwrote.length && e.kind === "stock" && e.local !== undefined) {
      const options = [e.local, e.after, String(Number(e.read) + (e.delta ?? 0))];
      const row = step.sim!.tables.find((t) => t.id === "row");
      const before = row?.rows.at(-2)?.cells[1];
      const expected = step.sim!.metrics.find((m) => m.id === "expected")?.value;
      const picks = [
        ...new Set([e.after, ...(before ? [before] : []), ...(expected ? [expected] : []), ...options]),
      ]
        .filter((o) => /^-?\d+$/.test(o))
        .slice(0, 3);
      return made(
        `${e.editor}'s write arrives. What's the stock after it?`,
        numeric(picks.map(Number)),
        e.after,
        { kind: "final-value" },
      );
    }
    if ((e.cas && e.outcome === "rejected") || (!e.cas && e.overwrote.length))
      return made(
        e.cas
          ? `${e.editor}'s write expects v${e.expected}. Does it apply or get rejected?`
          : `${e.editor}'s write was worked out from v${e.expected}. Does it apply or get rejected?`,
        Object.values(WRITE_OUTCOME_OPTIONS),
        WRITE_OUTCOME_OPTIONS[e.outcome ?? "applied"],
        { kind: "write-outcome" },
      );
    // A retry: an earlier write by the same editor in this replay was rejected.
    const retry = trace.steps.some(
      (s, k) =>
        k < trace.steps.indexOf(step) &&
        s.sim?.run === step.sim!.run &&
        s.sim?.edit?.editor === e.editor &&
        s.sim.edit.outcome === "rejected",
    );
    if (e.cas && e.outcome === "applied" && retry) {
      const v = e.expected;
      return made(
        `${e.editor} retries the change. Which version does the new write expect?`,
        [`v${v - 1}`, `v${v}`, `v${v + 1}`],
        `v${v}`,
        { kind: "cas-expect" },
      );
    }
    return undefined;
  },
  // Reads from a replica. With read-your-writes: "Where does this read go?"; without it, a read that comes back stale
  // asks which version the replica returns, and one that doesn't asks whether the replica has caught up.
  ({ step, scene }) => {
    const r = step.sim?.read;
    if (!r || !r.token || !scene.elements.some((e) => e.type === "sequence" || e.type === "data-table"))
      return undefined;
    const write = `v${r.token}`;
    if (r.fix)
      return made(
        `${r.user} reloads carrying her token, ${write}. Where does this read go with read-your-writes?`,
        Object.values(READ_ROUTE_OPTIONS),
        READ_ROUTE_OPTIONS[r.store],
        { kind: "read-route" },
      );
    if (r.store !== "replica") return undefined;
    if (r.returned < r.token) {
      const returned = `v${r.returned}`;
      const options = [...new Set([returned, write, ...shownVersions(step)])].slice(0, 3);
      return made(
        `${r.user} reloads, and the app reads from the replica. Which version does the replica return here?`,
        arrange(options, returned, scene.id),
        returned,
        { kind: "replica-version" },
      );
    }
    return made(
      `${r.user} reloads again. Has the replica caught up to her write, ${write}, yet?`,
      YES_NO,
      r.replicaAt >= r.token ? "Yes" : "No",
      { kind: "caught-up" },
    );
  },
  // A balancer's routing decision: "Where does round robin send R140?"
  ({ step, scene }) => {
    const r = step.sim?.route;
    if (!r || !scene.elements.some((e) => e.type === "sequence")) return undefined;
    const prompt =
      r.policy === "round-robin"
        ? `${r.request} arrives at the balancer. Where does round robin send it?`
        : `${r.request} arrives at the balancer. Which server does least outstanding pick?`;
    return made(prompt, Object.values(SERVER_NAMES), SERVER_NAMES[r.chosen], {
      kind: "route",
      request: r.request,
    });
  },
  // A health check's verdict: "Is Server 2 marked unhealthy now?"
  ({ step, scene }) => {
    if (step.kind !== "unhealthy" && step.kind !== "healthy") return undefined;
    if (!step.sim?.health || !scene.elements.some((e) => e.type === "sequence" || e.type === "data-table"))
      return undefined;
    const server = "server-2";
    const unhealthy = step.sim.health.find((h) => h.id === server)?.healthy === false;
    return made(`Is ${SERVER_NAMES[server]} marked unhealthy now?`, ["Yes", "No"], unhealthy ? "Yes" : "No", {
      kind: "health",
      server,
    });
  },
  // A growth story's first saturation anywhere: "Which part saturates first?"
  ({ step, scene }) => {
    const load = step.sim?.load;
    if (!load || load.current === undefined) return undefined;
    if (!scene.elements.some((e) => e.type === "load-chart" || e.type === "system-diagram")) return undefined;
    const now = load.windows[load.current];
    if (!now.saturated.length || load.windows.slice(0, load.current).some((w) => w.saturated.length))
      return undefined;
    // The question compares app servers with the database: only where both were measured.
    if (!now.utilization.some((u) => u.id.startsWith("server"))) return undefined;
    const servers = now.saturated.some((id) => id.startsWith("server"));
    const correct = servers ? SATURATION_OPTIONS.servers : SATURATION_OPTIONS.db;
    return made(
      "Traffic passes what the system can take. Which part saturates first?",
      Object.values(SATURATION_OPTIONS),
      correct,
      { kind: "saturates-first" },
    );
  },
  // A growth story's next window: "What happens to p99?" (only when the change isn't close to a threshold).
  ({ step, scene }) => {
    const load = step.sim?.load;
    if (!load || load.current === undefined || load.current === 0) return undefined;
    if (!scene.elements.some((e) => e.type === "load-chart")) return undefined;
    const now = load.windows[load.current];
    const before = load.windows[load.current - 1];
    // Only when the traffic changed (a growth story's ramp), not between windows of a fault at one rate.
    if (before.group !== now.group || before.p99 <= 0 || before.offered === now.offered) return undefined;
    const ratio = now.p99 / before.p99;
    if ([1.25, 3].some((edge) => Math.abs(ratio - edge) / edge < 0.1)) return undefined;
    return made(
      `Traffic goes from ${before.label} to ${now.label} requests a second. What happens to p99?`,
      [...P99_OPTIONS],
      p99Trend(before.p99, now.p99),
      { kind: "p99-trend" },
    );
  },
  // A simulation's decision: "The retry reaches the API. What does the API do?"
  ({ step, scene }) => {
    const d = step.sim?.decision;
    if (!d || (d.actor !== "api" && d.actor !== "provider")) return undefined;
    if (!scene.elements.some((e) => e.type === "sequence" || e.type === "system-diagram")) return undefined;
    const options: Record<string, string> = DECISION_OPTIONS[d.actor];
    const correct = options[d.choice];
    if (!correct) return undefined;
    const prompt =
      d.actor === "api"
        ? "A retry with the same key reaches the API. What does the API do?"
        : "A second charge request reaches the provider. What does the provider do?";
    return made(prompt, Object.values(options), correct, { kind: "decision", actor: d.actor });
  },
  // A design call's output: "What does get(1) return?"
  ({ trace, step, scene }) => {
    if (!step.op?.returned || !trace.ops) return undefined;
    const { call, output } = trace.ops[step.op.current];
    if (output === "—" || !scene.elements.some((e) => e.type === "op-log")) return undefined;
    const others = [...new Set(trace.ops.map((o) => o.output).filter((o) => o !== "—" && o !== output))];
    const pool = isInt(output) && !others.includes("-1") ? [...others, "-1"] : others;
    return made(
      `What does ${call} return?`,
      arrange([output, ...pool.slice(0, 2)], output, scene.id),
      output,
      {
        kind: "output",
        call: step.op.current,
      },
    );
  },
  // A greedy decision: "Which does it choose?"
  ({ step, scene }) => {
    if (!step.choice?.rejected || !scene.elements.some((e) => e.type === "choice")) return undefined;
    const { chosen, rejected } = step.choice;
    return made("Which does it choose?", arrange([chosen, rejected], chosen, scene.id), chosen, {
      kind: "choice",
    });
  },
  // A comparison in the video's own words: "4 + 45 vs 50: what happens next?" (too low / found / too high).
  ({ step, scene, scenes, trace }) => {
    const eq = step.equation;
    const shown = scene.elements.find((e) => e.type === "equation");
    if (!eq?.comparison || shown?.type !== "equation" || !shown.verdict) return undefined;
    const words = verdictWords(scenes, trace);
    const mine = words.get(shown.verdict);
    if (mine?.size !== 1 || !mine.has(eq.comparison.op) || /\d/.test(shown.verdict)) return undefined;
    // One verdict per comparison result, in < = > order, each used for only that result in the video.
    const options = (["<", "=", ">"] as const).flatMap((op) => {
      // A verdict with a number in it ("2 boards") belongs to one step, not to a kind of result.
      const word = [...words].find(([w, ops]) => ops.size === 1 && ops.has(op) && !/\d/.test(w))?.[0];
      return op === eq.comparison!.op ? [shown.verdict!] : word ? [word] : [];
    });
    const expr = eq.terms.map((t) => (t < 0 ? `(${t})` : String(t))).join(` ${OP[eq.operator]} `);
    return made(`${expr} vs ${eq.comparison.target}: what happens next?`, options, shown.verdict, {
      kind: "verdict",
      terms: eq.terms,
      operator: eq.operator,
      target: eq.comparison.target,
    });
  },
  // A comparison: "Is 4 + 45 less than, equal to, or greater than 50?"
  ({ step, scene }) => {
    const eq = step.equation;
    if (!eq?.comparison || eq.terms.length < 2 || !scene.elements.some((e) => e.type === "equation"))
      return undefined;
    const expr = eq.terms.map((t) => (t < 0 ? `(${t})` : String(t))).join(` ${OP[eq.operator]} `);
    const options = COMPARE_OPTIONS(eq.comparison.target);
    const correct = options[["<", "=", ">"].indexOf(eq.comparison.op)];
    return made(
      `Is ${expr} less than, equal to, or greater than ${eq.comparison.target}?`,
      options,
      correct,
      {
        kind: "compare",
        terms: eq.terms,
        operator: eq.operator,
        target: eq.comparison.target,
      },
    );
  },
  // A hash map lookup: "Is 6 already in the register?"
  ({ step, prior, elements }) => {
    const lookup = step.map?.lookup;
    const map = elements.find((e) => e.type === "hash-map");
    if (!lookup || map?.type !== "hash-map") return undefined;
    // Only a plain lookup: "found" means the key was stored before this step (a count map may say otherwise).
    const stored = (prior?.map?.entries ?? []).some((e) => e.key === lookup.key);
    if (stored !== lookup.found) return undefined;
    return made(`Is ${lookup.key} already in the ${map.kind}?`, YES_NO, lookup.found ? "Yes" : "No", {
      kind: "lookup",
      key: lookup.key,
    });
  },
  // A heap pop: "Which value leaves the heap next?"
  ({ step, scene }) => {
    const h = step.heaps?.findIndex((x) => x.popped) ?? -1;
    if (h === -1 || !scene.elements.some((e) => e.type === "heap")) return undefined;
    const heap = step.heaps![h];
    const correct = heap.popped!.label;
    // The nearest keys still in the heap: the plausible wrong answers.
    const others = [...heap.items]
      .filter((x) => x.label !== correct)
      .sort((a, b) => Math.abs(a.key - heap.popped!.key) - Math.abs(b.key - heap.popped!.key))
      .slice(0, 2)
      .map((x) => x.label);
    const prompt =
      step.heaps!.length > 1
        ? `Which value leaves the ${heap.kind}-heap next?`
        : "Which value leaves the heap next?";
    return made(prompt, arrange([correct, ...others], correct, scene.id), correct, {
      kind: "heap-pop",
      heap: h,
    });
  },
  // A DP cell: "What value goes in the next cell?"
  ({ step, scene, trace }) => {
    const table = step.table;
    if (!table?.current || !scene.elements.some((e) => e.type === "dp-table")) return undefined;
    const [r, c] = table.current;
    const value = table.cells[r][c];
    if (typeof value !== "number") return undefined;
    const reads = (table.reads ?? [])
      .map(({ at }) => table.cells[at[0]][at[1]])
      .filter((v): v is number => typeof v === "number");
    const headers = (trace.dp?.rows ?? 1) > 1 ? [trace.dp?.rowHeaders?.[r], trace.dp?.colHeaders?.[c]] : [];
    const where =
      headers.length === 2 && headers.every((h) => h && h.trim() !== "")
        ? ` (row ${headers[0]}, column ${headers[1]})`
        : "";
    return made(
      `What value goes in the next cell${where}?`,
      numeric([value, ...near(value, reads, 2)]),
      String(value),
      {
        kind: "cell",
        cell: [r, c],
      },
    );
  },
  // A call returning: "What does the call on 9 return?"
  ({ step, trace, scene }) => {
    const ret = step.tree?.returned;
    const nodes = trace.tree?.nodes;
    if (!ret || !nodes || !scene.elements.some((e) => e.type === "binary-tree")) return undefined;
    const child = nodes[ret.to]?.[ret.side];
    if (child === null || child === undefined) return undefined;
    const value = ret.value;
    let options: string[];
    if (value === "true" || value === "false") options = ["true", "false"];
    else if (isInt(value)) options = numeric([Number(value), ...near(Number(value), [], 2)]);
    else return undefined;
    return made(`What does the call on ${trace.row.values[child]} return?`, options, value, {
      kind: "returns",
      node: child,
    });
  },
  // Union-find: "Are b and d already in the same group?"
  ({ step, scene }) => {
    const forest = step.forest;
    if (!forest || (forest.same === undefined && !forest.union) || (forest.finds?.length ?? 0) < 2)
      return undefined;
    if (!scene.elements.some((e) => e.type === "union-find")) return undefined;
    const [a, b] = [forest.finds![0].path[0], forest.finds![1].path[0]];
    if (a === b) return undefined;
    return made(
      `Are ${forest.labels[a]} and ${forest.labels[b]} already in the same group?`,
      YES_NO,
      forest.same !== undefined ? "Yes" : "No",
      { kind: "same-group", a, b },
    );
  },
  // A trie insert: "How many new nodes does stem add?"
  ({ step, prior, trace, scene }) => {
    const trie = step.trie;
    if (!trie || !scene.elements.some((e) => e.type === "trie") || !step.active || step.active.length !== 1)
      return undefined;
    const word = String(trace.row.values[step.active[0]] ?? "");
    const before = prior?.trie?.nodes.length ?? 1;
    const added = trie.nodes.length - before;
    if (!/^[a-z]+$/.test(word) || added < 0 || added > word.length || (trie.created?.length ?? 0) !== added)
      return undefined;
    // Only an insert step: every new node is on this word's path.
    if (added === 0 && !step.kind.includes("insert")) return undefined;
    const counts = [
      ...new Set([added, ...near(added, [0, word.length], 2)].filter((n) => n >= 0 && n <= word.length)),
    ];
    return made(`How many new nodes does ${word} add?`, numeric(counts), String(added), { kind: "trie-new" });
  },
  // A stack pop: "How many items come off the stack?"
  ({ step, prior, scene }) => {
    const pile = step.pile;
    if (!pile?.popped?.length || !scene.elements.some((e) => e.type === "stack")) return undefined;
    const n = pile.popped.length;
    if ((prior?.pile?.items.length ?? 0) < n) return undefined;
    const counts = [...new Set([n, ...near(n, [0], 2)].filter((k) => k >= 0))];
    return made("How many items come off the stack?", numeric(counts), String(n), { kind: "stack-pop" });
  },
  // A queue: "Which leaves the queue next?"
  ({ step, prior, scene }) => {
    const out = step.queue?.dequeued;
    const queued = prior?.queue?.items ?? [];
    if (!out || queued.length < 2 || !scene.elements.some((e) => e.type === "queue")) return undefined;
    const others = [queued.at(-1)!, queued[1]].map((x) => x.label).filter((l) => l !== out.label);
    return made(
      "Which leaves the queue next?",
      arrange([out.label, ...others], out.label, step.note),
      out.label,
      {
        kind: "queue",
      },
    );
  },
  // Fast and slow pointers: "Do the jogger and the sprinter meet this round?"
  ({ step, elements }) => {
    const race = step.race;
    // Only a full round: both pointers make every hop (a refused or off-the-end move isn't a race round).
    if (!race || race.phase !== 1 || race.moves.length !== 2) return undefined;
    if (race.moves.some((m) => m.blocked !== undefined || m.to === null || m.hops === 0)) return undefined;
    const labels = Object.fromEntries(pointersIn(elements).map((p) => [p.binds, p.label]));
    const [slow, fast] = race.moves.map((m) => m.pointer);
    if (!labels[slow] || !labels[fast] || slow === fast) return undefined;
    const [a, b] = [pointerSubject(labels[slow]), pointerSubject(labels[fast])];
    if (!a || !b || a === "you" || b === "you") return undefined;
    return made(
      `Do ${a} and ${b} land together this round?`,
      YES_NO,
      race.meet !== undefined ? "Yes" : "No",
      {
        kind: "meet",
        slow,
        fast,
      },
    );
  },
  // A linked list's link: "Where does 7 point next?"
  ({ step, prior, scene }) => {
    const rewired = step.links?.rewired;
    const nodes = prior?.links?.nodes;
    if (rewired?.length !== 1 || !nodes || !scene.elements.some((e) => e.type === "linked-list"))
      return undefined;
    const { node, from, to } = rewired[0];
    const label = (id: number | null) =>
      id === null ? "null" : String(nodes.find((n) => n.id === id)?.value ?? "");
    const real = nodes.filter((n) => !n.dummy);
    // Values must name nodes unambiguously.
    if (new Set(real.map((n) => String(n.value))).size !== real.length) return undefined;
    const me = nodes.find((n) => n.id === node);
    if (!me || me.dummy) return undefined;
    const other = real.find((n) => n.id !== node && n.id !== from && n.id !== to && n.lane === me.lane);
    const options = [label(to), label(from), ...(other ? [label(other.id)] : [])].filter((o) => o !== "");
    return made(`Where does ${me.value} point next?`, arrange(options, label(to), scene.id), label(to), {
      kind: "rewire",
      node,
    });
  },
  // A backtracking step: "Next choice: +4. What happens?"
  ({ step, prior, trace, scene }) => {
    const nodes = trace.searchTree?.nodes;
    if (!step.explore || !nodes || !scene.elements.some((e) => e.type === "search-tree")) return undefined;
    const fresh = step.explore.reached.filter((id) => !(prior?.explore?.reached ?? []).includes(id));
    if (fresh.length !== 1) return undefined;
    const node = nodes[fresh[0]];
    if (!node?.edge) return undefined;
    const correct = node.pruned
      ? EXPLORE_OPTIONS[2]
      : step.explore.solutions.includes(node.id)
        ? EXPLORE_OPTIONS[1]
        : EXPLORE_OPTIONS[0];
    return made(`Next choice: ${node.edge}. What happens?`, [...EXPLORE_OPTIONS], correct, {
      kind: "explore",
      node: node.id,
    });
  },
  // A trie walk: "Is there already a node for r under a?"
  ({ step, prior, scene }) => {
    const trie = step.trie;
    const earlier = prior?.trie?.nodes ?? [{ id: 0, parent: null, letter: "", end: false }];
    if (!trie || !scene.elements.some((e) => e.type === "trie")) return undefined;
    const pick = trie.missing
      ? { parent: trie.missing.parent, letter: trie.missing.letter }
      : trie.created?.length
        ? trie.nodes.find((n) => n.id === trie.created![0])
        : trie.path.length > 1
          ? trie.nodes.find((n) => n.id === trie.path.at(-1))
          : undefined;
    if (!pick || pick.parent === null || pick.parent === undefined || pick.letter.length !== 1)
      return undefined;
    const parent = earlier.find((n) => n.id === pick.parent);
    if (!parent) return undefined;
    const under = parent.id === 0 ? "the root" : parent.letter;
    const exists = earlier.some((n) => n.parent === pick.parent && n.letter === pick.letter);
    return made(`Is there already a node for ${pick.letter} under ${under}?`, YES_NO, exists ? "Yes" : "No", {
      kind: "trie-child",
      parent: pick.parent,
      letter: pick.letter,
    });
  },
  // Pointers: "Which one moves next?"
  ({ step, trace, shownStep, elements, scene }) => {
    if (shownStep === undefined) return undefined;
    const shown = trace.steps[shownStep].pointers;
    const pointers = pointersIn(elements).filter(
      (p) => shown[p.binds] !== undefined && step.pointers[p.binds] !== undefined,
    );
    if (pointers.length < 2 || new Set(pointers.map((p) => p.label)).size !== pointers.length)
      return undefined;
    const moved = pointers.filter((p) => shown[p.binds] !== step.pointers[p.binds]);
    if (moved.length !== 1) return undefined;
    const ordered = arrange(
      pointers.map((p) => p.label),
      moved[0].label,
      scene.id,
    );
    return made("Which one moves next?", ordered, moved[0].label, {
      kind: "pointer",
      binds: ordered.map((label) => pointers.find((p) => p.label === label)!.binds),
      fromStep: shownStep,
    });
  },
];
