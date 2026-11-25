import { z } from "zod";

import type { TraceSim, TraceSimRow, TraceSimTable, TraceSimToken, TraceSystem } from "@/lib/traces/types";

import { EventLoop } from "./events";
import { jitter, streams } from "./random";

/**
 * "Why was the customer charged twice?": a client pays for one order through an API that charges a payment provider.
 * Two hops, four links, and any message on either hop can be lost:
 *
 *   client ──pay──▶ API ──charge──▶ provider
 *   client ◀─paid── API ◀───ok───── provider
 *
 * The client gives up on an attempt after a timeout and retries; the API gives up on a provider call after its own
 * timeout and retries that. Without protection a retry is just a new payment. The safeguards, each a switch:
 *
 * - `key`: the client sends one idempotency key per order (the same on every retry), and the API keeps a record per
 *   key with the result once it's known, so a retry of a finished payment gets the stored result.
 * - `inProgress`: the API writes the key's record as "in progress" (an atomic insert-if-absent) before it charges, so
 *   a retry that arrives while the first attempt is still running waits for its result. Without it the API only checks
 *   for a finished record (a plain read) and writes it after charging, so an overlapping retry charges again.
 * - `forwardKey`: the API passes the key to the provider, which deduplicates by it too, so the API's own retries of a
 *   lost provider response can't charge twice.
 *
 * The key store sits next to the API and is reliable (its calls aren't messages that can be lost), and nothing
 * crashes: the lesson's proof covers lost messages only. A crash between charging and recording is the Payments case
 * study's problem.
 */

export const LINKS = ["client→api", "api→provider", "provider→api", "api→client"] as const;
export type Link = (typeof LINKS)[number];

const lossSchema = z.object({ link: z.enum(LINKS), nth: z.number().int().min(1).max(8) });
export type Loss = z.infer<typeof lossSchema>;

export const paymentScenarioSchema = z
  .object({
    /** What this replay is called on screen ("no key", "with key"). */
    label: z.string().trim().min(1).max(20),
    seed: z.number().int().min(0).max(999_999),
    key: z.boolean(),
    forwardKey: z.boolean(),
    inProgress: z.boolean(),
    clientTimeoutMs: z.number().int().min(500).max(6000),
    clientRetries: z.number().int().min(0).max(3),
    retryBackoffMs: z.number().int().min(0).max(2000),
    providerTimeoutMs: z.number().int().min(500).max(6000),
    providerRetries: z.number().int().min(0).max(2),
    /** How long the provider takes to charge a card (plus up to 100 ms of seeded variation). */
    providerWorkMs: z.number().int().min(100).max(4000),
    /** Messages lost on the way: the `nth` message sent on `link` in this run. */
    lose: z.array(lossSchema).max(2),
  })
  .refine((s) => s.key || (!s.forwardKey && !s.inProgress), {
    message: "forwarding the key and an in-progress record both need an idempotency key",
  });
export type PaymentScenario = z.infer<typeof paymentScenarioSchema>;

/** The diagram's components: the client, the API with its key store under it, and the provider. */
export const PAYMENT_SYSTEM: TraceSystem = {
  nodes: [
    { id: "client", label: "Client", kind: "client", x: 0, y: 0 },
    { id: "api", label: "API", kind: "server", x: 1, y: 0 },
    { id: "provider", label: "Provider", kind: "external", x: 2, y: 0 },
    { id: "keys", label: "Keys", kind: "store", x: 1, y: 1 },
  ],
  edges: [
    { from: "client", to: "api" },
    { from: "api", to: "provider" },
    { from: "api", to: "keys" },
  ],
};

const ENDS: Record<Link, [string, string]> = {
  "client→api": ["client", "api"],
  "api→provider": ["api", "provider"],
  "provider→api": ["provider", "api"],
  "api→client": ["api", "client"],
};
/** One-way latency: base + up to `spread` ms, drawn from the link's own stream. */
const LATENCY: Record<Link, [number, number]> = {
  "client→api": [40, 20],
  "api→provider": [60, 30],
  "provider→api": [60, 30],
  "api→client": [40, 20],
};
/** The key store answers in this long (a local database call). */
const KEY_STORE_MS = 5;

export const ORDER = "order 17";
export const KEY = "k-17";
export const AMOUNT = "$40";
const ATTEMPT = ["R1", "R1′", "R1″", "R1‴"];

/** A step of a run, before it's numbered into a trace. */
export type SimStep = { kind: string; key: boolean; note: string; sim: TraceSim };

export type SimRun = {
  steps: SimStep[];
  /** Charges in the provider's ledger for the order. */
  charges: number;
  /** How the client's payment ended. */
  outcome: "paid" | "failed" | "pending";
  /** Calls the API made to the provider (retries included). */
  providerCalls: number;
  /** Every message sent, in order, as the loss plan would name it. */
  messages: Loss[];
};

type Attempt = { n: number; label: string; settled: boolean };
type Call = { n: number; attempt: Attempt; settled: boolean };
type KeyRecord = { state: "in progress" | "done"; charge?: string };

/**
 * Run one scenario. `record: false` skips building step snapshots (the proof runs hundreds of scenarios and only
 * needs the outcome).
 */
export function simulatePayment(
  scenario: PaymentScenario,
  options: { run?: number; record?: boolean } = {},
): SimRun {
  const s = scenario;
  const run = options.run ?? 0;
  const record = options.record ?? true;
  const loop = new EventLoop();
  const rng = streams(s.seed);
  const lost = new Set(s.lose.map((l) => `${l.link}#${l.nth}`));
  const sent: Record<Link, number> = {
    "client→api": 0,
    "api→provider": 0,
    "provider→api": 0,
    "api→client": 0,
  };
  const messages: Loss[] = [];
  const steps: SimStep[] = [];
  const rows: TraceSimRow[] = [];
  const inFlight = new Map<string, TraceSimToken>();

  // State.
  const keys = new Map<string, KeyRecord>();
  const providerKeys = new Map<string, KeyRecord>();
  const ledger: { id: string; key?: string }[] = [];
  const waiters: Attempt[] = [];
  const providerWaiters: (() => void)[] = [];
  let attempts = 0;
  let providerCalls = 0;
  let providerBusy = 0;
  const apiActive = new Set<Attempt>();
  let clientPending: Attempt | undefined;
  let outcome: SimRun["outcome"] = "pending";
  const violations: string[] = [];
  let rowSeq = 0;
  let marks: { table: string; row: number; mark: "new" | "read" | "duplicate" | "waiting" }[] = [];
  let chargeDelta = 0;

  const ms = (t: number) => `${t} ms`;

  function snapshot(
    kind: string,
    note: string,
    opts: {
      key?: boolean;
      current?: string;
      token?: TraceSimToken;
      decision?: TraceSim["decision"];
    } = {},
  ) {
    if (!record) {
      marks = [];
      chargeDelta = 0;
      return;
    }
    const tokens = [...inFlight.values()].map((t) => ({ ...t }));
    if (opts.token) tokens.push(opts.token);
    const keyRows: TraceSimTable["rows"] = [...keys.entries()].map(([k, r]) => ({
      cells: [k, r.state === "done" ? `done · ${r.charge}` : "in progress"],
    }));
    const ledgerRows: TraceSimTable["rows"] = ledger.map((c) => ({
      cells: [c.id, `${AMOUNT} · ${c.key ?? ORDER}`],
    }));
    for (const m of marks) {
      const rowsOf = m.table === "keys" ? keyRows : ledgerRows;
      if (rowsOf[m.row]) rowsOf[m.row].mark = m.mark;
    }
    const sim: TraceSim = {
      run,
      runLabel: s.label,
      t: loop.now,
      nodes: [
        clientPending
          ? { id: "client", state: "waiting", badge: `waits on ${clientPending.label}` }
          : {
              id: "client",
              state: "idle",
              ...(outcome !== "pending" && { badge: outcome === "paid" ? "paid ✓" : "gave up ✕" }),
            },
        apiActive.size > 0
          ? { id: "api", state: "busy", badge: [...apiActive].map((a) => a.label).join(", ") }
          : waiters.length > 0
            ? { id: "api", state: "waiting", badge: `${waiters.map((a) => a.label).join(", ")} waits` }
            : { id: "api", state: "idle" },
        providerBusy > 0
          ? { id: "provider", state: "busy", badge: "charging" }
          : { id: "provider", state: "idle" },
        { id: "keys", state: "idle", badge: `${keys.size} ${keys.size === 1 ? "key" : "keys"}` },
      ],
      tokens,
      rows: rows.map((r) => ({ ...r })),
      ...(opts.current && { current: opts.current }),
      tables: [
        { id: "keys", title: "API keys", columns: ["key", "state"], rows: keyRows },
        { id: "ledger", title: "Provider ledger", columns: ["charge", "for"], rows: ledgerRows },
      ],
      metrics: [
        {
          id: "charges",
          label: "charges",
          value: String(ledger.length),
          ...(chargeDelta && { delta: chargeDelta }),
        },
        { id: "attempts", label: "attempts", value: String(attempts) },
        { id: "time", label: "time", value: ms(loop.now) },
      ],
      ...(opts.decision && { decision: opts.decision }),
      violations: [...violations],
    };
    steps.push({ kind, key: opts.key ?? false, note, sim });
    marks = [];
    chargeDelta = 0;
  }

  const note = (lane: string, text: string, tone: "positive" | "negative" | "neutral") => {
    const id = `r${++rowSeq}`;
    if (record) rows.push({ kind: "note", id, lane, text, at: loop.now, tone });
    return id;
  };

  /** Send a message; `onArrive` runs when (if) it gets there. Returns nothing: arrival and loss are their own steps. */
  function send(link: Link, label: string, describe: string, onArrive: (rowId: string) => void) {
    const nth = ++sent[link];
    messages.push({ link, nth });
    const [from, to] = ENDS[link];
    const id = `r${++rowSeq}`;
    const row: TraceSimRow = { kind: "message", id, from, to, label, at: loop.now, status: "in-flight" };
    if (record) {
      rows.push(row);
      inFlight.set(id, { id, label, from, to, status: "moving" });
    }
    const [base, spread] = LATENCY[link];
    const delay = jitter(rng(`latency:${link}`), base, spread);
    loop.after(delay, () => {
      inFlight.delete(id);
      if (lost.has(`${link}#${nth}`)) {
        row.status = "lost";
        snapshot("lost", `${describe} is lost on the way from the ${nameOf(from)} to the ${nameOf(to)}.`, {
          key: true,
          current: id,
          token: { id, label, from, to, status: "lost" },
        });
        return;
      }
      row.status = "delivered";
      onArrive(id);
    });
  }

  const nameOf = (id: string) =>
    id === "api" ? "API" : (PAYMENT_SYSTEM.nodes.find((n) => n.id === id)?.label.toLowerCase() ?? id);

  // --- Client ------------------------------------------------------------------------------------------------

  function sendAttempt(n: number) {
    attempts++;
    const attempt: Attempt = { n, label: ATTEMPT[n - 1], settled: false };
    clientPending = attempt;
    const label = `pay ${AMOUNT}${s.key ? ` · ${KEY}` : ""}`;
    send("client→api", label, `${attempt.label} (${label})`, (rowId) => {
      apiActive.add(attempt);
      snapshot("arrive", `${attempt.label} reaches the API${s.key ? ` with key ${KEY}` : ", with no key"}.`, {
        current: rowId,
        token: { id: rowId, label, from: "client", to: "api", status: "arrived" },
      });
      handleRequest(attempt);
    });
    loop.after(s.clientTimeoutMs, () => {
      if (attempt.settled) return;
      attempt.settled = true;
      clientPending = undefined;
      const retry = n <= s.clientRetries;
      const rowId = note("client", `⏱ ${attempt.label} timed out`, "negative");
      snapshot(
        "timeout",
        `${attempt.label} gets no answer within ${s.clientTimeoutMs} ms, so the client stops waiting${retry ? ` and retries in ${s.retryBackoffMs} ms` : " and gives up"}.`,
        { current: rowId },
      );
      if (retry) loop.after(s.retryBackoffMs, () => sendAttempt(n + 1));
      else {
        outcome = "failed";
        snapshot("outcome", `The client has no retries left: the payment fails.`);
      }
    });
  }

  function clientReceives(attempt: Attempt, rowId: string, ok: boolean, charge: string | undefined) {
    const row = rows.find((r) => r.id === rowId);
    if (attempt.settled) {
      if (row && row.kind === "message") row.status = "ignored";
      snapshot(
        "late",
        `The answer to ${attempt.label} arrives after the client stopped waiting for it, so it's ignored.`,
        {
          current: rowId,
        },
      );
      return;
    }
    attempt.settled = true;
    clientPending = undefined;
    if (ok) {
      outcome = "paid";
      snapshot(
        "outcome",
        ledger.length > 1
          ? `The client gets "paid ${charge}" for ${attempt.label} and shows one payment, but ${ORDER} was charged ${ledger.length} times.`
          : `The client gets "paid ${charge}" for ${attempt.label}: one payment, one charge.`,
        { current: rowId },
      );
    } else if (attempt.n <= s.clientRetries) {
      snapshot("error", `${attempt.label} gets an error; the client retries in ${s.retryBackoffMs} ms.`, {
        current: rowId,
      });
      loop.after(s.retryBackoffMs, () => sendAttempt(attempt.n + 1));
    } else {
      outcome = "failed";
      snapshot(
        "outcome",
        `${attempt.label} gets an error and the client has no retries left: the payment fails.`,
        {
          current: rowId,
        },
      );
    }
  }

  // --- API ---------------------------------------------------------------------------------------------------

  function respond(attempt: Attempt, ok: boolean, charge?: string) {
    apiActive.delete(attempt);
    const label = ok ? `paid ${charge}` : "error 504";
    send("api→client", label, `The API's answer to ${attempt.label} ("${label}")`, (rowId) =>
      clientReceives(attempt, rowId, ok, charge),
    );
  }

  function handleRequest(attempt: Attempt) {
    if (!s.key) return startCharge(attempt);
    loop.after(KEY_STORE_MS, () => {
      const rec = keys.get(KEY);
      if (rec?.state === "done") {
        marks.push({ table: "keys", row: rowIndex(KEY), mark: "read" });
        const rowId = note("api", `${KEY} done: reply ${rec.charge}`, "positive");
        snapshot(
          "stored-result",
          `Key ${KEY} is already done, so the API returns the stored result ${rec.charge} for ${attempt.label} without charging.`,
          { key: true, current: rowId, decision: { actor: "api", choice: "stored-result" } },
        );
        respond(attempt, true, rec.charge);
        return;
      }
      if (s.inProgress) {
        if (rec) {
          waiters.push(attempt);
          apiActive.delete(attempt);
          marks.push({ table: "keys", row: rowIndex(KEY), mark: "waiting" });
          const rowId = note("api", `${KEY} in progress: ${attempt.label} waits`, "positive");
          snapshot(
            "wait",
            `Key ${KEY} is still in progress (an earlier attempt is being charged), so ${attempt.label} waits for its result instead of charging.`,
            { key: true, current: rowId, decision: { actor: "api", choice: "wait" } },
          );
          return;
        }
        keys.set(KEY, { state: "in progress" });
        marks.push({ table: "keys", row: rowIndex(KEY), mark: "new" });
        const rowId = note("api", `${KEY} → in progress`, "neutral");
        snapshot(
          "key-insert",
          `The API records key ${KEY} as in progress (insert-if-absent) before charging.`,
          {
            current: rowId,
          },
        );
        return startCharge(attempt);
      }
      // A plain read: no finished record yet, so the API charges and writes the record afterwards.
      const rowId = note("api", `no done record for ${KEY}`, "neutral");
      snapshot(
        "key-miss",
        `The API finds no finished record for ${KEY}, so ${attempt.label} goes on to charge.`,
        {
          current: rowId,
          decision: { actor: "api", choice: "charge" },
        },
      );
      startCharge(attempt);
    });
  }

  const rowIndex = (k: string) => [...keys.keys()].indexOf(k);

  function startCharge(attempt: Attempt) {
    callProvider(attempt, 1);
  }

  function callProvider(attempt: Attempt, tryNo: number) {
    providerCalls++;
    const call: Call = { n: providerCalls, attempt, settled: false };
    const forwarded = s.forwardKey ? KEY : undefined;
    const label = `charge ${AMOUNT}${forwarded ? ` · ${KEY}` : ""}`;
    send("api→provider", label, `The API's charge request for ${attempt.label} (${label})`, (rowId) => {
      providerBusy++;
      snapshot(
        "arrive",
        `The charge request for ${attempt.label} reaches the provider${forwarded ? ` with key ${KEY}` : ""}.`,
        {
          current: rowId,
          token: { id: rowId, label, from: "api", to: "provider", status: "arrived" },
        },
      );
      providerHandles(call, forwarded);
    });
    loop.after(s.providerTimeoutMs, () => {
      if (call.settled) return;
      call.settled = true;
      const retry = tryNo <= s.providerRetries;
      const rowId = note("api", `⏱ provider call timed out`, "negative");
      snapshot(
        "provider-timeout",
        `The API hears nothing from the provider within ${s.providerTimeoutMs} ms${retry ? ` and sends the charge request again${forwarded ? ` with the same key ${KEY}` : ""}` : " and gives up"}.`,
        { current: rowId },
      );
      if (retry) return callProvider(attempt, tryNo + 1);
      // Give up: release the key so a client retry can try again, and answer every waiter with an error.
      if (s.key && keys.get(KEY)?.state === "in progress") keys.delete(KEY);
      for (const w of waiters.splice(0)) respond(w, false);
      respond(attempt, false);
    });
  }

  function apiGetsCharge(call: Call, rowId: string, charge: string) {
    if (call.settled) {
      const row = rows.find((r) => r.id === rowId);
      if (row && row.kind === "message") row.status = "ignored";
      snapshot(
        "late",
        `The provider's answer (${charge}) arrives after the API gave up on that call, so it's ignored.`,
        {
          current: rowId,
        },
      );
      return;
    }
    call.settled = true;
    const { attempt } = call;
    if (s.key) {
      keys.set(KEY, { state: "done", charge });
      marks.push({ table: "keys", row: rowIndex(KEY), mark: "new" });
      const id = note("api", `${KEY} → done · ${charge}`, "neutral");
      snapshot("key-done", `The API stores the result ${charge} under key ${KEY}.`, { current: id });
    } else {
      snapshot("arrive", `The provider's answer (${charge}) reaches the API.`, { current: rowId });
    }
    const waiting = waiters.splice(0);
    for (const w of waiting) {
      apiActive.add(w);
      const id = note("api", `${w.label} gets ${charge}`, "positive");
      snapshot("waiter-result", `${w.label} was waiting on key ${KEY}: it gets the same result, ${charge}.`, {
        current: id,
      });
    }
    respond(attempt, true, charge);
    for (const w of waiting) respond(w, true, charge);
  }

  // --- Provider ------------------------------------------------------------------------------------------------

  function reply(call: Call, charge: string, again: boolean) {
    const label = `ok ${charge}${again ? " again" : ""}`;
    send("provider→api", label, `The provider's answer (${label})`, (rowId) =>
      apiGetsCharge(call, rowId, charge),
    );
  }

  function providerHandles(call: Call, forwarded: string | undefined) {
    if (forwarded) {
      const pk = providerKeys.get(forwarded);
      if (pk?.state === "done") {
        providerBusy--;
        const i = ledger.findIndex((c) => c.id === pk.charge);
        marks.push({ table: "ledger", row: i, mark: "read" });
        const rowId = note("provider", `${forwarded} seen: ${pk.charge}`, "positive");
        snapshot(
          "dedupe",
          `The provider already has key ${forwarded}, so it returns ${pk.charge} instead of charging again.`,
          { key: true, current: rowId, decision: { actor: "provider", choice: "dedupe" } },
        );
        reply(call, pk.charge!, true);
        return;
      }
      if (pk) {
        providerBusy--;
        providerWaiters.push(() => {
          const id = note("provider", `${forwarded} seen: ${pk.charge}`, "positive");
          snapshot(
            "dedupe",
            `The provider finishes key ${forwarded}'s first charge and returns ${pk.charge} for this request too, without a second charge.`,
            { key: true, current: id, decision: { actor: "provider", choice: "dedupe" } },
          );
          reply(call, pk.charge!, true);
        });
        return;
      }
      providerKeys.set(forwarded, { state: "in progress" });
    }
    loop.after(jitter(rng("work:provider"), s.providerWorkMs, 100), () => {
      providerBusy--;
      const id = `ch_${ledger.length + 1}`;
      ledger.push({ id, key: forwarded });
      chargeDelta = 1;
      const duplicate = ledger.length > 1;
      if (duplicate) violations.push(`${ORDER} charged twice`);
      marks.push({ table: "ledger", row: ledger.length - 1, mark: duplicate ? "duplicate" : "new" });
      const rowId = note(
        "provider",
        duplicate ? `charge ${id} ✕ duplicate` : `charge ${id}`,
        duplicate ? "negative" : "neutral",
      );
      snapshot(
        duplicate ? "duplicate-charge" : "charge",
        duplicate
          ? `The provider charges ${AMOUNT} again (${id}): ${ORDER} is now charged twice.`
          : `The provider charges the card ${AMOUNT} (${id}).`,
        { key: duplicate, current: rowId, decision: { actor: "provider", choice: "charge" } },
      );
      if (forwarded) {
        providerKeys.set(forwarded, { state: "done", charge: id });
        for (const w of providerWaiters.splice(0)) w();
      }
      reply(call, id, false);
    });
  }

  sendAttempt(1);
  loop.run();
  return { steps, charges: ledger.length, outcome, providerCalls, messages };
}

// --- The proof ---------------------------------------------------------------------------------------------------

export type Proof = {
  /** Runs with one lost message: every message the scenario sends, on both hops. */
  singles: number;
  /** Runs with two: each single, plus every message sent after its loss (retries included). */
  pairs: number;
  runs: number;
  /** Runs that charged the order more than once. */
  doubleCharges: number;
  /** The loss plans that double-charged (for tests and messages). */
  failing: Loss[][];
  /** Every link a lost message was tried on. */
  links: Link[];
};

/**
 * Check a scenario against every place a message can be lost: each message of the failure-free run (singles), and
 * for each single, each message sent after the lost one (pairs: this reaches the retries' own messages). Bounded,
 * not a proof over every possible system: one scenario's timings, at most two losses, and no crashes.
 */
export function proveAgainstLostMessages(base: PaymentScenario): Proof {
  const plan = (lose: Loss[]) => simulatePayment({ ...base, lose }, { record: false });
  const failing: Loss[][] = [];
  const links = new Set<Link>();
  let singles = 0;
  let pairs = 0;
  const check = (lose: Loss[]) => {
    const result = plan(lose);
    for (const l of lose) links.add(l.link);
    if (result.charges > 1) failing.push(lose);
    return result;
  };
  for (const first of plan([]).messages) {
    singles++;
    const after = check([first]);
    const at = after.messages.findIndex((m) => m.link === first.link && m.nth === first.nth);
    for (const second of after.messages.slice(at + 1)) {
      pairs++;
      check([first, second]);
    }
  }
  return {
    singles,
    pairs,
    runs: singles + pairs,
    doubleCharges: failing.length,
    failing,
    links: LINKS.filter((l) => links.has(l)),
  };
}
