import { defineLesson } from "@/lib/catalog";

/**
 * A thread at version 40, about 2 comments a second and 30 page reads a second from 20 users; the replica's mean lag is
 * 100 ms until a 3-second lag spike from 3 s (versions take about 2 s). Ana posts at 3.5 s and reloads 300 ms after
 * the primary confirms, then every second until she sees her comment.
 */
const base = {
  seed: 7,
  lagMs: 100,
  spike: { atMs: 3000, durationMs: 3000, lagMs: 2000 },
  readAfterMs: 300,
  follow: { atMs: 3500 },
};

export const vanishedComment = defineLesson({
  slug: "vanished-comment",
  topicSlug: "replication",
  title: "I posted a comment and it vanished",
  kind: "incident",
  status: "available",
  symptom: "A user posted a comment, reloaded, and it was gone; it came back a few seconds later.",
  order: 0,
  minutes: 4,
  report: `Ana posts a comment and sees "posted". She reloads the page, and her comment isn't there. She reloads again: still gone. A moment later it's back, as if nothing happened.

Nothing was lost and nothing crashed: the comment was safely stored the whole time. Support can't reproduce it, because by the time anyone looks, everything is fine.`,
  whatWentWrong: `The app writes to a primary database and reads from a replica, a copy that spreads the read load. The primary confirms Ana's comment as soon as it has stored it; a replication stream then carries it to the replica, which applies changes in order.

That takes time: usually about a tenth of a second, but during a lag spike (the replica busy with a backup, say) every change takes about 2 seconds to arrive. Ana's reload came 300 ms after "posted", went to the replica, and the replica hadn't applied her comment yet. Her comment came back once the replica caught up.`,
  fix: `**Read-your-writes:** the session remembers the version of its last confirmed write (a token, such as "version 42"). The replica serves a read only if it has applied at least that version; otherwise the read goes to the primary, which always has it.

Everyone else still reads from the replica, and so does Ana once it has caught up. The cost is measured, not hidden: every read redirected to the primary adds load there, and the more the replica lags, the more reads move back. Waiting briefly for the replica to catch up is the other common choice (slower reads instead of primary load); this lesson simulates sending the read to the primary.`,
  proofScope: `The simulation checks the rule on every read (Ana's and every other user's) issued after the user's write was confirmed over seeds 1–20, mean lags of 50, 200, 500, and 1000 ms, with and without a 3-second lag spike to about 2 s, and with users reloading 100, 300, and 1000 ms after posting. Reading from the replica breaks the rule in most of those runs; read-your-writes breaks it in none. The guarantee needs one primary that takes every write and an ordered replication stream, the session's token sent with every read (a second device without it isn't covered: a test shows the comment vanishing again), and no failover to a replica that lacks a confirmed write. Versions, not clock times, decide, so clock skew doesn't matter. Latencies are illustrative.`,
  rules: [
    "After a user's write is confirmed, that user's later reads never return an older version than the one their write created.",
  ],
  takeaways: [
    "A replica is a copy that lags behind: reading from it can show a user the past, even their own past.",
    "Read-your-writes keeps a token of the user's last write and reads from the replica only once it has caught up to it.",
    "The fix moves some reads back to the primary, and more of them the more the replica lags: measure it.",
    "Use versions, not clock times, to decide whether a copy is up to date.",
  ],
  replays: [
    {
      args: [
        [
          { label: "no fix", ...base, fix: "none" },
          { label: "the fix", ...base, fix: "read-your-writes" },
        ],
        { seeds: [1, 20], lags: [50, 200, 500, 1000], spikes: [false, true], readAfter: [100, 300, 1000] },
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["replication", "consistency", "read-your-writes"],
});
