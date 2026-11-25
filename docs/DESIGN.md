# algovizlib: design

How the app is put together, for someone reading the code for the first time. The working reference for every
rule and convention (and the place agents and contributors read first) is [CLAUDE.md](../CLAUDE.md); this page is the
short version.

## The idea in one diagram

Every video is data, and every number on screen comes from running the real algorithm.

```
catalog problem ──► trace ──────────────► storyboard ──► validator ──► player
 (statement,        (deterministic         (scenes:       (schema +     (Remotion,
  examples,          instrumented           narration,     arithmetic +  in the
  reference          solution: every        captions,      every value   browser)
  solution)          decision as a step)    elements)      vs. the trace)
```

1. **Catalog.** 20 patterns in four groups, 103 problems. Each problem is a typed file (Zod schema): an original
   statement, examples with machine-readable `args` and `expected`, hints, and the key idea. Each example is checked
   against an independent, test-only reference solution.
2. **Trace.** For each problem, an instrumented solution (`src/lib/traces/<pattern>/<slug>.ts`) runs the algorithm on
   one example and records every decision as a step: pointers, comparisons, the state of the structure (a window, a
   heap, a DP table, a linked list's links…), and a one-sentence note. Key steps are the ones a video must show.
3. **Storyboard.** Typed data: 6–10 scenes, each with narration, a caption, and elements (cards, bars, pointers,
   equations, trees, graphs, tables: 47 primitive types). A scene can bind to a trace step and leave out every value
   the step already knows; the resolver fills them in. Storyboards are hand-written or generated offline by a model
   (`pnpm generate:storyboards`); the model writes the story, and code decides whether it's correct.
4. **Validator.** `validateStoryboard()` rejects a storyboard whose arithmetic is wrong, whose pointers sit in the
   wrong place, whose structure differs from the trace at that step, or that skips a key step. Nothing reaches the
   site without passing it.
5. **Player.** `@remotion/player` renders the storyboard as a composition in the browser (no video files). Theme,
   reduced motion, and the player's on-screen width are inputs, so text stays readable on a phone.

## System design: a simulation as the ground truth

System design lessons use the same loop with a **deterministic, seeded discrete-event simulation** in place of a
trace (`src/lib/sim/`). It runs in the browser and in tests, and every number on screen (which message was lost,
when a client timed out, which request read which stored value, how many charges the ledger holds) comes from it.

```
scenario ──► simulation ──────────────► storyboard ──► validator ──► player
 (components,   (event loop, virtual        (scenes bound     (every message,
  timings,       clock, seeded streams;      to simulation     state, table row,
  failures,      a step per event worth      steps)            metric, and the
  safeguards)    showing; rule checks)                         topology)
```

- **Determinism.** A virtual clock in whole milliseconds; events ordered by time, then by when they were scheduled.
  No `Math.random` and no real clock: every draw comes from a named stream seeded from the scenario's seed and the
  stream's name, so streams don't affect each other and the same scenario always replays exactly.
- **What a step records:** the event and its time; each component's state and a short note; the messages on their
  links; the replay's sequence of messages and notes so far; the stored tables (idempotency keys, a ledger); metrics;
  the decision a component made (charge, return a stored result, wait, deduplicate); the lesson's rules broken so far.
- **Growth rule.** In a growth story, a component the system grows (a balancer, a second server) is marked as added
  after the component the simulation measured saturated; the validator rejects any scene that shows it before an
  earlier scene showed that measurement.
- **Proving the fix.** For small scenarios, the tests and the lesson's last step lose every message of a failure-free
  run, and for each of those every message sent after it (which reaches the retries' own messages). Without the fix
  some placement breaks the rule; with it none does. Bounded, and said so on screen.
- **Limits.** Latencies are illustrative distributions, not measurements; runs are small (no traffic at scale); races
  come from scheduling, not threads; there's no clock skew yet; the proof covers lost messages, not crashes.
- **Plugging in.** A lesson's storyboard binds to the simulation through the same trace binding (steps carry a `sim`
  state; the trace carries the system's components), so resolution, key-step coverage, quick checks, the tutor's step
  context, progress, resume, and the review queue work unchanged. Four primitives draw it: a system diagram with
  messages travelling links, a sequence view of one replay, stored tables, and metrics.

**Curriculum.** Fundamentals (estimates, load balancing, caching and stampedes, replication lag, sharding and hot
keys, concurrent writes, idempotency and retry storms, backpressure, rate limiting, timeouts) and case studies (URL
shortener, rate limiter service, chat, news feed, payments), each an **incident replay** (a real class of bug, then
the fix under the same failures) or a **growth story** (one server upward, a component added only after the
simulation measures the bottleneck that justifies it).

**The first growth story, "Is one server enough?"** Estimate the peak (40,000 users × 54 requests a day ÷ 86,400 s
= 25 req/s on average, × 3 = 75 at peak), then ramp traffic on one server: at 60 req/s its 4 workers saturate (about
50 served a second, the queue growing, p99 at a second; the database 2% busy). Only after that measured bottleneck
does a balancer and a second server appear (the validator's growth rule), and the replay measures the new limit
(about 100 req/s). Tests check the saturation point against workers ÷ service time and Little's law.

**The flagship, "Why was the customer charged twice?"** A client pays through an API that charges a payment provider;
either hop can lose a message. Without protection, a retry after a lost "paid" answer is a second payment. The fix: one
idempotency key per order, sent on every retry; the API claims it as "in progress" atomically before charging (an
overlapping retry waits for the result), stores the result under it, and forwards it to the provider, which
deduplicates too (so the API's own retries are safe). Checked against every single and double lost message on both hops (not crashes): 66 runs, 0
double charges. A crash between charging and recording is left for the Payments case study.

## Where things live

```
src/app/            routes (Next.js App Router, Cache Components): landing, /dsa, patterns, problems, /system-design
                    and its lessons, /review,
                    /me, auth pages, /api/* (auth, progress, quick checks, review, tutor, health)
src/content/        catalog (one file per pattern and problem), storyboards (+ generated JSON), narration manifest
src/lib/catalog/    schemas and the repository: the only way pages read content
src/lib/traces/     instrumented solutions (app code: the video resolves values from them)
src/lib/storyboard/ schemas, resolver, validator, shared timeline
src/video/          the Remotion composition, primitives, layout, and the phone-width fit checks
src/lib/progress/   progress records and rules, browser and account copies
src/lib/quickcheck/ questions built from the trace, their validator, and recorded answers
src/lib/walkthrough/"Try your own input": specs, parsing, and the in-browser build pipeline
src/lib/review/     the review queue's rules and schedule
src/lib/sim/        system design: the event loop, seeded streams, models (payments), proofs, "Your scenario"
src/lib/tutor/      "Ask about this step" (server only)
src/lib/generation/ offline storyboard and narration generation (never imported by the app)
tests/              Vitest; tests/reference-solutions/ is test-only
```

## Decisions worth knowing

**Static pages, data in the browser.** Every catalog page is prerendered. Session, progress, and the review queue
load in the browser, so a deploy serves HTML from the CDN and only `/api/*` runs on the server. The Remotion player is
loaded with `next/dynamic({ ssr: false })` because it reads the clock while rendering.

**Correctness by construction, not by review.** The model (or a person) can write anything; the schema, the resolver,
and the validator decide what ships. The same checks run on "Try your own input", where the browser builds a
walkthrough from the learner's input, refuses it if it fails validation or wouldn't fit a phone screen, and simplifies
scenes before giving up.

**One timeline.** `getSceneTimeline()` is the only source of scene start frames and cross-fade overlap. The
composition, scene list, scrubber, keyboard shortcuts, narration, quick-check pause points, and resume positions all
read it.

**Narration follows a single track.** Voiced videos play one stitched ElevenLabs MP3 per video; scene lengths come from
where each scene's speech starts in that track, so scene changes never touch the audio. Unvoiced videos use the
browser's speech synthesis, and the video waits at a scene's end rather than cutting a sentence.

**Accounts are optional.** Guests keep progress, quick-check answers, and review state in localStorage. Signing in
(GitHub or Google; email + password behind a flag) merges that into Postgres with rules that never lose information:
the more advanced status wins, the newer video position wins, every answer is kept once. Unverified accounts stay on
the browser copy.

**Features fail safe.** A missing table (a deploy whose migration hasn't run) returns a 503 with a log line naming the
fix; the browser keeps its data and the page keeps working. `/api/health` reports missing tables and pending
migrations.

**Server code stays on the server.** Modules holding secrets import `server-only`, and a test reads every client
component's imports. Generation code and AI SDKs are forbidden in app code by an ESLint rule and a test (the tutor's
server modules are the one exception).

## Data model

Postgres through Prisma 7 (`prisma/schema.prisma`, committed migrations): Auth.js's tables, `AuthToken` (hashed,
single-use verification and reset tokens), `RateLimit` (fixed-window counters shared by every instance), `Progress`,
`CheckResult` (quick-check answers), `ReviewState` (review intervals and snoozes), and `AskCache` (tutor answers to
suggested questions, with nothing that identifies the asker). Deleting a user cascades.

## Testing

Vitest, no network: models and OAuth providers are mocked, and the database tests run against a local Postgres
(skipped without one).

- Every catalog example against its reference solution, with the problem's judge (exact, unordered, float…).
- Every trace against the reference solution on every example that fits on screen.
- Every storyboard through the schema and the validator, plus mutated copies that must fail.
- Every scene of every video laid out at phone width: values fit their cards, pointers don't overlap, nothing runs into
  the bottom panel. A test forbids literal font sizes in the video code.
- Every quick-check question validated against the trace, with every word checked against what's on screen.
- 70 walkthrough specs with seeded random inputs: each parses back to itself, matches the reference answer, and builds a
  walkthrough that validates and fits.
- Auth flows, rate limits, token single use, account linking, progress merge, the tutor's grounding and limits, the
  review queue's rules, and the narration pipeline (stitching is checked by cross-correlating each clip in the track).

Browser checks (Playwright, muted, with a silent speech fake) cover phone and desktop widths in both themes with axe.
