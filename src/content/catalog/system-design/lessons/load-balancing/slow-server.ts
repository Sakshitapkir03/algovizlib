import { defineLesson } from "@/lib/catalog";

/**
 * Two servers with 4 workers each (~80 ms a request), 40 requests a second, clients giving up after 1 s. At 3 s
 * server 2's work starts taking 6 times longer; at 9 s it recovers. R-numbers from 3.5 s on are followed in full.
 */
const base = {
  seed: 3,
  workers: 4,
  serviceMs: 80,
  rps: 40,
  degrade: { atMs: 3000, factor: 6, recoverAtMs: 9000 },
  followAtMs: 3500,
};

export const slowServer = defineLesson({
  slug: "slow-server",
  topicSlug: "load-balancing",
  title: "One slow server takes everyone down",
  kind: "incident",
  status: "available",
  symptom: "One server's disk slowed down, and every user's requests started timing out.",
  order: 0,
  minutes: 4,
  report: `Two app servers sit behind a load balancer, and both have plenty of room. Then one server's disk starts acting up and its requests take six times longer.

Within seconds, about half of all requests are slow or time out, even though the other server is mostly idle. Nothing crashed, and the balancer says both servers are up.`,
  whatWentWrong: `The balancer used round robin: every other request goes to server 2, whatever state it's in. Server 2 now finishes about 8 requests a second but keeps getting 20, so its queue grows and its requests wait seconds, past the client's 1-second timeout.

Meanwhile server 1 has free workers. A request is waiting behind the slow server while the healthy one could have started it at once.`,
  fix: `Two changes, each fixing part of it.

- **Least-outstanding routing:** send each request to the server with the fewest requests in progress. When both servers have the same number of workers, a server's free workers are its workers minus its requests in progress, so the one with the fewest in progress has a free worker whenever either does: the balancer never sends a request to a full server while the other has room.
- **Health checks:** every second the balancer sends each server a tiny check. Two that don't answer within 200 ms in a row mark the server unhealthy, and it gets no new requests; two that pass mark it healthy again, so it rejoins on its own once it recovers.

Least-outstanding alone still sends the slow server a request whenever it has a free worker, and those take half a second. Health checks take it out of rotation until it's fast again.`,
  proofScope: `The simulation checks rule 1 at every routing decision, over seeds 1–20 and four slowdowns of server 2 (3×, 5×, 8× slower, and hanging), at 40 requests a second, with both servers at 4 workers. Round robin breaks it in every run; least-outstanding routing with health checks breaks it in none, and never sends a request to a server marked unhealthy. The guarantee holds only when both servers have the same number of workers. Requests on their way to a server count as in progress, and so do the health checks, and a request stops counting the moment its server finishes it, so the balancer's counts never lag behind the servers (a test shows that counts arriving even 20 ms late would break it). The rule is about the decision: a worker that frees up after a request was routed can't be counted. Service times are illustrative.`,
  rules: [
    "Rule 1: the balancer never sends a request to a server with no free worker while another healthy server has one (least-outstanding guarantees it only when both servers have the same number of workers).",
    "Rule 2: a server marked unhealthy gets no requests until it's marked healthy again.",
  ],
  takeaways: [
    "Round robin ignores how busy a server is, so one slow server drags down every request sent to it.",
    "Least-outstanding sends work where there's room: with equal servers, no request waits while another server is free.",
    "Health checks take a server that can't answer out of rotation, and bring it back once it can.",
    "Watch p99 and timeouts per server, not just averages: half the users can suffer while the averages look fine.",
  ],
  replays: [
    {
      args: [
        [
          { label: "round robin", ...base, policy: "round-robin", health: null },
          { label: "the fix", ...base, policy: "least-outstanding", health: { intervalMs: 1000 } },
        ],
        { seeds: [1, 20], factors: [3, 5, 8, 50] },
      ],
    },
  ],
  relatedPatterns: [],
  tags: ["load balancing", "health checks", "latency"],
});
