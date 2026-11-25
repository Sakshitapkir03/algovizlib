import { defineTopic } from "@/lib/catalog";

/** System design topics, in /system-design order (group, then position). Slugs never reuse a DSA pattern's (tested). */
export const topics = [
  defineTopic({
    slug: "estimates",
    name: "Estimates & capacity",
    group: "foundations",
    summary: "Back-of-envelope numbers, and the moment one server stops being enough.",
    order: 0,
  }),
  defineTopic({
    slug: "load-balancing",
    name: "Load balancing",
    group: "foundations",
    summary: "Spreading requests across servers, and what a slow one does to everyone else.",
    order: 1,
  }),
  defineTopic({
    slug: "caching",
    name: "Caching",
    group: "data",
    summary: "Where stale data sneaks in, and what happens when a hot entry expires.",
    order: 2,
  }),
  defineTopic({
    slug: "replication",
    name: "Replication",
    group: "data",
    summary: "Copies that lag behind, and reading your own writes.",
    order: 3,
  }),
  defineTopic({
    slug: "sharding",
    name: "Sharding",
    group: "data",
    summary: "Splitting data across machines, and the key that's hotter than the rest.",
    order: 4,
  }),
  defineTopic({
    slug: "consistency",
    name: "Consistency",
    group: "data",
    summary: "Concurrent writes, and the update that quietly disappears.",
    order: 5,
  }),
  defineTopic({
    slug: "idempotency",
    name: "Idempotency & retries",
    group: "reliability",
    summary: "Making a retry safe, and keeping retries from making an outage worse.",
    order: 6,
  }),
  defineTopic({
    slug: "queues",
    name: "Queues & backpressure",
    group: "reliability",
    summary: "Absorbing bursts without letting a backlog grow forever.",
    order: 7,
  }),
  defineTopic({
    slug: "rate-limiting",
    name: "Rate limiting",
    group: "reliability",
    summary: "Keeping one client from using up everyone's capacity.",
    order: 8,
  }),
  defineTopic({
    slug: "timeouts",
    name: "Timeouts & failure",
    group: "reliability",
    summary: "What a hanging dependency does to the callers waiting on it.",
    order: 9,
  }),
  defineTopic({
    slug: "case-studies",
    name: "Case studies",
    group: "case-studies",
    summary: "Whole systems, grown one measured bottleneck at a time.",
    order: 10,
  }),
];

export const topicGroups = [
  {
    slug: "foundations",
    name: "Foundations",
    summary: "How much load one machine takes, and how to spread it.",
  },
  {
    slug: "data",
    name: "Data & consistency",
    summary: "Caches, copies, and shards, and the bugs between them.",
  },
  {
    slug: "reliability",
    name: "Reliability",
    summary: "Retries, limits, and timeouts: surviving failures without causing new ones.",
  },
  { slug: "case-studies", name: "Case studies", summary: "End-to-end designs built from the pieces above." },
] as const;
