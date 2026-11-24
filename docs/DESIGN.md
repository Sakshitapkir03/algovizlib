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

## Where things live

```
src/app/            routes (Next.js App Router, Cache Components): landing, /dsa, patterns, problems, /review,
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
