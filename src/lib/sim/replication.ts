import { z } from "zod";

import { EventLoop } from "./events";
import { jitter, streams } from "./random";

/**
 * "I posted a comment and it vanished": an app with a primary database and one read replica. Every write (a comment
 * on one thread) goes to the primary, which gives the thread its next version and confirms it; a replication stream
 * then carries each version to the replica, which applies them in order. Reads go to the replica to spread the load.
 *
 * Replication lag: each version reaches the replica after a delay drawn around `lagMs` (most arrive a little sooner
 * than the mean, a few much later), or around `spike.lagMs` for versions committed during a lag spike. The replica
 * applies versions strictly in order, so a version committed after a spike still waits for the ones ahead of it.
 *
 * Users: one followed user ("Ana") posts at `follow.atMs` and reloads `readAfterMs` after the primary confirms, then
 * every `retryEveryMs` until she sees her comment (at most `maxReloads` reloads). Background users post at
 * `writesPerSec` (each reloads about `readAfterMs` after their own write) and browse at `readsPerSec`.
 *
 * The fix, read-your-writes: each session remembers the version of its last confirmed write (its token). A read is
 * served by the replica only if the replica has applied at least that version; otherwise it goes to the primary. The
 * app decides with the replica's applied version at the moment of the decision (it can only grow while the read
 * travels, so the replica returns at least that much).
 *
 * The rule, checked on every read: after a user's write is confirmed, that user's later reads (issued after the
 * confirmation; a read already on its way is concurrent with it) never return an older version than the one their
 * write created. It depends on one primary taking every write and one ordered stream; on
 * the token travelling with every read of the session (`deviceSwitch`, test only, sends the followed user's reloads
 * from a second device without it); and on reads never going to a store that lacks a confirmed write (no failover).
 * Latencies are illustrative.
 */

export const replicationScenarioSchema = z.object({
  label: z.string().trim().min(1).max(12),
  seed: z.number().int().min(0).max(999_999),
  fix: z.enum(["none", "read-your-writes"]),
  /** The mean replication delay (ms). */
  lagMs: z.number().int().min(0).max(3000),
  /** For `durationMs` from `atMs`, versions committed take about `lagMs` to reach the replica instead. */
  spike: z
    .object({
      atMs: z.number().int().nonnegative(),
      durationMs: z.number().int().min(100).max(10_000),
      lagMs: z.number().int().min(0).max(5000),
    })
    .nullable(),
  /** How soon after the primary confirms a write its author reloads (ms). */
  readAfterMs: z.number().int().min(20).max(3000),
  users: z.number().int().min(2).max(50).default(20),
  writesPerSec: z.number().min(0.5).max(10).default(2),
  readsPerSec: z.number().min(1).max(100).default(30),
  durationMs: z.number().int().min(1000).max(20_000).default(10_000),
  /** The followed user's write; null: nobody is followed. */
  follow: z.object({ atMs: z.number().int().nonnegative() }).nullable().default(null),
  retryEveryMs: z.number().int().min(200).max(5000).default(1000),
  maxReloads: z.number().int().min(1).max(8).default(5),
  /** Test only: the followed user's reloads come from a second device that doesn't carry her token. */
  deviceSwitch: z.boolean().default(false),
});
export type ReplicationScenario = z.infer<typeof replicationScenarioSchema>;
export type ReplicationScenarioInput = z.input<typeof replicationScenarioSchema>;

export const FOLLOWED = "Ana";
export type Store = "primary" | "replica";

/** Both stores at a moment: their versions and who wrote the last few. */
export type StoresSnapshot = {
  primary: number;
  replica: number;
  /** How long the oldest version the replica hasn't applied has been waiting (0 when caught up). */
  behindMs: number;
  /** The author of each version, by version (index 0 is version 1). */
  authors: string[];
};

/** One read: who asked, where it went, what it returned, and the session's token at that moment. */
export type ReadRecord = {
  t: number;
  user: string;
  store: Store;
  returned: number;
  /** The session's last confirmed write (0: none). */
  token: number;
  /** The replica's applied version when the app decided. */
  replicaAt: number;
  /** A reload right after the user's own write. */
  afterWrite: boolean;
  stale: boolean;
};

export type ReplicationEvent = (
  | { kind: "spike"; t: number; lagMs: number; durationMs: number }
  | { kind: "write"; t: number; version: number }
  | { kind: "ack"; t: number; version: number }
  | { kind: "apply"; t: number; version: number; delayMs: number }
  | { kind: "read"; t: number; read: ReadRecord }
) & { stores: StoresSnapshot };
type EventBody = ReplicationEvent extends infer E
  ? E extends ReplicationEvent
    ? Omit<E, "stores">
    : never
  : never;

export type ReplicationRun = {
  events: ReplicationEvent[];
  reads: number;
  primaryReads: number;
  replicaReads: number;
  writes: number;
  /** Reloads right after the author's own write, and how many of them were stale. */
  reloadsAfterWrite: number;
  staleReloads: number;
  /** Every read that returned an older version than its session's token. */
  violations: { t: number; user: string; returned: number; token: number }[];
};

/** The thread's version when the run starts. */
export const START_VERSION = 40;

/** A small network hop between the app and a store (illustrative). */
const HOP = { base: 2, spread: 3 };

export function simulateReplication(
  input: ReplicationScenarioInput,
  options: { record?: boolean } = {},
): ReplicationRun {
  const s = replicationScenarioSchema.parse(input);
  const record = options.record ?? true;
  const loop = new EventLoop(s.durationMs + 60_000, 200_000);
  const rng = streams(s.seed);
  // Writes and reads draw their network hops from separate streams, so how many reads there are (the fix changes
  // how often Ana reloads) never shifts when writes land.
  const hop = (kind: "write" | "read") => jitter(rng(`net:${kind}`), HOP.base, HOP.spread);

  // Versions: authors[v - 1] wrote version v; commitAt[v - 1] is when the primary committed it.
  // The thread already has comments (both stores agree on them before the run starts).
  const authors: string[] = Array.from(
    { length: START_VERSION },
    (_, k) => `u${1 + ((k * 7) % (s.users - 1))}`,
  );
  const commitAt: number[] = Array.from({ length: START_VERSION }, () => 0);
  let primary = START_VERSION;
  let replica = START_VERSION;
  let lastApply = 0;
  const tokens = new Map<string, number>();
  const events: ReplicationEvent[] = [];
  const run: ReplicationRun = {
    events,
    reads: 0,
    primaryReads: 0,
    replicaReads: 0,
    writes: 0,
    reloadsAfterWrite: 0,
    staleReloads: 0,
    violations: [],
  };
  const snapshot = (): StoresSnapshot => ({
    primary,
    replica,
    behindMs: replica < primary ? loop.now - commitAt[replica] : 0,
    authors: [...authors],
  });
  const log = (e: EventBody) => {
    if (record) events.push({ ...e, stores: snapshot() } as ReplicationEvent);
  };
  const userName = (k: number) => `u${k}`;
  const lagAt = (t: number) =>
    s.spike && t >= s.spike.atMs && t < s.spike.atMs + s.spike.durationMs ? s.spike.lagMs : s.lagMs;

  /** The stream: version v reaches the replica after its delay, never before the versions ahead of it. */
  function ship(version: number) {
    const mean = lagAt(loop.now);
    // Half the mean plus an exponential tail: most versions arrive a little early, a few much later.
    const delay = Math.round(mean * (0.5 - 0.5 * Math.log(1 - rng("lag")())));
    const at = Math.max(lastApply, loop.now + delay);
    lastApply = at;
    loop.after(at - loop.now, () => {
      replica = version;
      if (authors[version - 1] === FOLLOWED)
        log({ kind: "apply", t: loop.now, version, delayMs: loop.now - commitAt[version - 1] });
    });
  }

  function write(user: string, followed: boolean, then: (version: number) => void) {
    loop.after(hop("write"), () => {
      primary++;
      const version = primary;
      authors.push(user);
      commitAt.push(loop.now);
      run.writes++;
      if (followed) log({ kind: "write", t: loop.now, version });
      ship(version);
      loop.after(hop("write"), () => {
        // Confirmed: the session remembers its write's version.
        tokens.set(user, version);
        if (followed) log({ kind: "ack", t: loop.now, version });
        then(version);
      });
    });
  }

  function read(
    user: string,
    opts: { afterWrite: boolean; followed: boolean; noToken?: boolean },
    then?: (r: ReadRecord) => void,
  ) {
    // The user's last confirmed write when the read is issued (a read already on its way when a write is confirmed
    // isn't "later" than it), and the token the read carries (none from a device that doesn't have it).
    const mine = tokens.get(user) ?? 0;
    const token = opts.noToken ? 0 : mine;
    const replicaAt = replica;
    const store: Store = s.fix === "read-your-writes" && replicaAt < token ? "primary" : "replica";
    loop.after(hop("read"), () => {
      const returned = store === "primary" ? primary : replica;
      // The rule is about the user: any version older than their own last confirmed write.
      const stale = returned < mine;
      const record: ReadRecord = {
        t: loop.now,
        user,
        store,
        returned,
        token,
        replicaAt,
        afterWrite: opts.afterWrite,
        stale,
      };
      run.reads++;
      if (store === "primary") run.primaryReads++;
      else run.replicaReads++;
      if (opts.afterWrite) {
        run.reloadsAfterWrite++;
        if (stale) run.staleReloads++;
      }
      if (stale) run.violations.push({ t: loop.now, user, returned, token: mine });
      if (opts.followed) log({ kind: "read", t: loop.now, read: record });
      then?.(record);
    });
  }

  // Background writers: a Poisson stream of comments from users 1…n−1, each followed by its author's reload.
  const gap = (perSec: number, stream: string) =>
    Math.max(1, Math.round((-Math.log(1 - rng(stream)()) / perSec) * 1000));
  function backgroundWrite() {
    const user = userName(1 + Math.floor(rng("writers")() * (s.users - 1)));
    const wait = Math.round(s.readAfterMs * (0.5 + rng("reload")()));
    write(user, false, () => loop.after(wait, () => read(user, { afterWrite: true, followed: false })));
    const next = gap(s.writesPerSec, "writes");
    if (loop.now + next < s.durationMs) loop.after(next, backgroundWrite);
  }
  function browse() {
    read(userName(1 + Math.floor(rng("browsers")() * (s.users - 1))), {
      afterWrite: false,
      followed: false,
    });
    const next = gap(s.readsPerSec, "reads");
    if (loop.now + next < s.durationMs) loop.after(next, browse);
  }
  loop.after(gap(s.writesPerSec, "writes"), backgroundWrite);
  loop.after(gap(s.readsPerSec, "reads"), browse);

  if (s.spike) {
    const spike = s.spike;
    loop.after(spike.atMs, () =>
      log({ kind: "spike", t: loop.now, lagMs: spike.lagMs, durationMs: spike.durationMs }),
    );
  }

  if (s.follow) {
    loop.after(s.follow.atMs, () =>
      write(FOLLOWED, true, (version) => {
        let reloads = 0;
        const reload = () => {
          reloads++;
          read(FOLLOWED, { afterWrite: reloads === 1, followed: true, noToken: s.deviceSwitch }, (r) => {
            if (r.returned < version && reloads < s.maxReloads) loop.after(s.retryEveryMs, reload);
          });
        };
        loop.after(s.readAfterMs, reload);
      }),
    );
  }

  loop.run();
  return run;
}
