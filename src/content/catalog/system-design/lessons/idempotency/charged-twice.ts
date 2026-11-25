import { defineLesson } from "@/lib/catalog";

/** The timings every replay starts from: the client waits 2 s, the API waits 3 s on the provider, a charge takes ~0.8 s. */
const base = {
  seed: 7,
  clientTimeoutMs: 2000,
  clientRetries: 2,
  retryBackoffMs: 300,
  providerTimeoutMs: 3000,
  providerRetries: 1,
  providerWorkMs: 800,
};
const fix = { key: true, forwardKey: true, inProgress: true };

export const chargedTwice = defineLesson({
  slug: "charged-twice",
  topicSlug: "idempotency",
  title: "Why was the customer charged twice?",
  kind: "incident",
  status: "available",
  symptom: "A customer clicked Pay once and was charged $40 twice.",
  order: 0,
  minutes: 4,
  report: `A support ticket arrives at 14:02: "I clicked Pay once. My bank shows two charges of $40 for order 17."

The logs show one order, two successful charges at the payment provider, and a client that retried once after a timeout. Nothing crashed, and every server says it did its job.`,
  whatWentWrong: `The first charge went through, but the API's "paid" answer was lost on the way back to the client. The client had heard nothing for 2 seconds, so it retried, and to the API the retry looked like a brand-new payment.

The client was right to retry: from where it sits, a lost answer and a lost request look exactly the same. So the server has to make a retry safe. The same bug hides in two more places:

- The provider's answer to the API can be lost too. If the API retries its own call, the provider charges again unless it can tell it's the same payment.
- A retry can arrive while the first attempt is still being charged. Checking "is this key done?" with a plain read misses it, because the record doesn't exist yet.`,
  fix: `The client creates one idempotency key per order (\`k-17\`) and sends it with every retry.

- Before charging, the API inserts the key as "in progress" in one atomic step (insert-if-absent). Only one attempt can win, and a retry that arrives in the meantime waits for that attempt's result.
- When the charge finishes, the API stores the result under the key. A later retry gets the stored result without charging.
- The API forwards the key to the provider, which deduplicates by it too, so the API can safely retry a provider call whose answer was lost.`,
  proofScope: `The simulation checks the fix against every place a message can be lost: each message of a normal payment on both hops (client and API, API and provider), and every second message lost after the first, which reaches the retries' own messages, under each replay's timings. It covers lost messages, not crashes: an API that crashes after charging and before recording the result is the Payments case study.`,
  rules: ["Order 17 is charged at most once."],
  takeaways: [
    "Clients retry because a lost answer and a lost request look the same; the server's job is to make the retry safe.",
    "Use one idempotency key per operation, sent on every retry and stored with the result.",
    "Claim the key atomically before doing the work, so an overlapping retry waits instead of repeating it.",
    "Pass the key on to every downstream service that must not do the work twice.",
  ],
  replays: [
    {
      args: [
        [
          {
            label: "no key",
            ...base,
            key: false,
            forwardKey: false,
            inProgress: false,
            lose: [{ link: "api→client", nth: 1 }],
          },
          { label: "key, answer lost", ...base, ...fix, lose: [{ link: "api→client", nth: 1 }] },
          {
            label: "key, provider lost",
            ...base,
            ...fix,
            clientTimeoutMs: 5000,
            lose: [{ link: "provider→api", nth: 1 }],
          },
          { label: "key, overlap", ...base, ...fix, providerWorkMs: 2600, lose: [] },
        ],
      ],
    },
  ],
  relatedPatterns: [
    {
      slug: "arrays-hashing",
      reason: "The API finds a retry's stored result by looking its key up in a hash map, in one step.",
    },
  ],
  tags: ["idempotency", "retries", "payments"],
});
