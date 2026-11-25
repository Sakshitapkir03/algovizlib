import { defineLesson } from "@/lib/catalog";

/** One server: 4 workers, ~80 ms per request (10 ms of it a database query), 100 requests of queue. */
const base = { seed: 11, workers: 4, serviceMs: 80 };

export const oneServer = defineLesson({
  slug: "one-server",
  topicSlug: "estimates",
  title: "Is one server enough?",
  kind: "growth",
  status: "available",
  symptom: "Signups doubled and every page got slow.",
  order: 0,
  minutes: 4,
  report: `A small team is launching an app on one server and a database. Before launch they want to know: will one server hold the busiest hour?

They expect 40,000 daily users making about 54 requests each. After launch, signups double, and at the evening peak every page takes seconds to load, then some fail.`,
  whatWentWrong: `Nothing broke: the server ran out of workers. Each of its 4 workers handles one request at a time, for about 80 milliseconds, so it can finish about 50 requests a second. Below that, requests barely wait. Past it, requests arrive faster than they finish, so the queue grows every second, p95 and p99 latency climb from a hundred milliseconds to seconds, and once the queue is full, new requests are turned away.

The database was never the problem: it stayed a few percent busy the whole time. Adding a bigger database, or caching its queries, would have changed nothing.`,
  fix: `Measure first, then scale the part that saturated: the app server.

- Put a load balancer in front and add a second server. Round robin sends every other request to each one.
- The measured limit roughly doubles, to about 100 requests a second, which covers the estimated peak of 75 with room to spare.
- Keep measuring: the second server raises the limit, it doesn't remove it. Past about 100 a second, both servers saturate the same way.`,
  proofScope: `Every number comes from the simulation: arrivals at each traffic level, measured over 10 simulated seconds per step, with each request's service time drawn from a seeded stream. Service times are illustrative, not measurements of real hardware. A test checks that in every window that isn't saturated, the average number of requests in the system equals throughput × mean latency (Little's law), and that the measured limit lands within 10% of workers ÷ service time.`,
  rules: [
    "A component is saturated when it's at least 95% busy and its queue grew or it turned requests away.",
    "The second server appears only after the simulation measured the first one saturated.",
  ],
  takeaways: [
    "Estimate first: users × requests a day ÷ 86,400 is the average rate; the peak is a few times that.",
    "A server's limit is roughly workers ÷ service time; past it, the queue grows and p99 climbs much faster than the median.",
    "Measure where it breaks, then scale the part that's actually saturated, not the one you suspect.",
    "Adding a server raises the limit; it doesn't remove it.",
  ],
  replays: [
    {
      args: [
        { users: 40_000, requestsPerUser: 54, peakFactor: 3 },
        [
          { label: "1 server", ...base, servers: 1, steps: [25, 40, 60, 75] },
          { label: "2 servers", ...base, servers: 2, steps: [60, 75, 110, 130] },
        ],
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["capacity", "load balancing", "estimates"],
});
