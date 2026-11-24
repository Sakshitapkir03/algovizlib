import { z } from "zod";

/**
 * One answered quick check. `id` is made in the browser when the answer is given, so sending it twice (a retry, a
 * merge after sign-in) stores it once. Walkthroughs of a learner's own input are `source: "walkthrough"` (with the
 * input, base64url as in the share link), so they're never counted as the problem's video.
 */
export const checkResultSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  problemKey: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  questionId: z.string().min(1).max(80),
  sceneId: z.string().min(1).max(80),
  step: z.number().int().nonnegative().max(10_000),
  correct: z.boolean(),
  source: z.enum(["video", "walkthrough"]),
  input: z.string().max(2000).optional(),
  answeredAt: z.number().int().nonnegative(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/** The most results one request carries (a merge after sign-in sends in batches). */
export const MAX_RESULTS_PER_REQUEST = 100;

/** Where a browser keeps results: every guest answer, and a signed-in learner's answers not yet sent. */
export const CHECKS_STORAGE_KEY = "algovizlib:checks:v1";
/** The browser keeps at most this many (the oldest go first). */
export const MAX_LOCAL_RESULTS = 2000;

const storedSchema = z.object({
  version: z.literal(1),
  results: z.array(checkResultSchema.extend({ pending: z.boolean().optional() })),
});
export type StoredResults = z.infer<typeof storedSchema>;

/** A place to keep a small JSON value (localStorage in the browser; a Map in tests). */
export type ResultStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readLocalResults(storage: ResultStorage | undefined): StoredResults["results"] {
  try {
    const raw = storage?.getItem(CHECKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.results : [];
  } catch {
    return [];
  }
}

function writeLocalResults(storage: ResultStorage | undefined, results: StoredResults["results"]) {
  try {
    storage?.setItem(
      CHECKS_STORAGE_KEY,
      JSON.stringify({ version: 1, results: results.slice(-MAX_LOCAL_RESULTS) } satisfies StoredResults),
    );
  } catch {
    // Storage blocked or full: this answer isn't kept, and nothing breaks.
  }
}

export type ResultTransport = { send(results: readonly CheckResult[]): Promise<void> };

export const httpResultTransport: ResultTransport = {
  async send(results) {
    const res = await fetch("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
      keepalive: true,
    });
    if (!res.ok) throw new Error(`Quick check results not saved (${res.status}).`);
  },
};

/**
 * Where answers go. A guest's (and an unverified account's) stay in this browser. For a verified account each answer
 * is kept here as pending, sent, and dropped from here once the account has it; if sending fails (offline, or the
 * server's table isn't there yet), it stays pending and goes with the next answer or the next sign-in. Nothing here
 * touches progress: answers never change a problem's status.
 */
export function createCheckRecorder(options: {
  storage: () => ResultStorage | undefined;
  transport?: ResultTransport;
}) {
  const transport = options.transport ?? httpResultTransport;
  let account = false;
  let flushing: Promise<void> | undefined;

  const flush = async (): Promise<void> => {
    if (!account) return;
    if (flushing) return flushing;
    const run = async () => {
      for (;;) {
        const pending = readLocalResults(options.storage()).filter((r) => r.pending);
        if (pending.length === 0 || !account) return;
        const batch = pending.slice(0, MAX_RESULTS_PER_REQUEST).map(({ pending: _, ...r }) => r);
        await transport.send(batch);
        const sent = new Set(batch.map((r) => r.id));
        writeLocalResults(
          options.storage(),
          readLocalResults(options.storage()).filter((r) => !sent.has(r.id)),
        );
      }
    };
    // Cleared after the run settles (never synchronously, so a run with nothing to send can't leave a stale one).
    flushing = run()
      .catch(() => {
        // Kept as pending; tried again with the next answer or sign-in.
      })
      .finally(() => {
        flushing = undefined;
      });
    return flushing;
  };

  return {
    /** Keep an answer (and send it, for a verified account). */
    record(result: CheckResult): Promise<void> {
      const parsed = checkResultSchema.safeParse(result);
      if (!parsed.success) return Promise.resolve();
      writeLocalResults(options.storage(), [
        ...readLocalResults(options.storage()),
        { ...parsed.data, ...(account ? { pending: true } : {}) },
      ]);
      return flush();
    },
    /**
     * The session changed. Signing in as a verified user sends everything this browser kept (a guest's answers
     * merge into the account, all of them kept); anyone else keeps answers here.
     */
    setAccount(verified: boolean): Promise<void> {
      account = verified;
      if (!verified) return Promise.resolve();
      const results = readLocalResults(options.storage());
      writeLocalResults(
        options.storage(),
        results.map((r) => ({ ...r, pending: true })),
      );
      return flush();
    },
    local: () => readLocalResults(options.storage()),
  };
}

/** A fresh id for an answer (random, URL-safe). */
export function newResultId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const browserStorage = (): ResultStorage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** The tab's recorder. */
export const checkRecorder = createCheckRecorder({ storage: browserStorage });
