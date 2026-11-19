@AGENTS.md

# algovizlib

A web app that teaches computer science concepts (DSA first, then system design) through a curated **catalog**
(category → pattern → problem) and short animated videos. Each video explains the **approach** through a concrete
real-world example, not a line-by-line code walkthrough. Narration will be voiced with ElevenLabs later.

Every video is driven by a **storyboard**: plain, typed data bound to a **trace** (the exact steps an algorithm takes
on one example). Storyboards are hand-written or generated offline by a model (`pnpm generate:storyboards`). Either
way, the model writes the story and deterministic code guarantees correctness: every storyboard passes the same
schema and trace validator before anyone sees it.

## Commands

```bash
pnpm dev          # http://localhost:3000
pnpm lint         # ESLint (next + typescript + prettier compat)
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # Vitest
pnpm build        # production build (static prerender)
pnpm format       # Prettier
pnpm generate:storyboards --pattern two-pointers --dry-run   # offline AI generation (see below)
```

Run `lint`, `typecheck`, `test`, and `build` before committing.

## Architecture

```
src/
  app/                       Next.js App Router (Cache Components + Partial Prefetching are on)
    page.tsx                 landing: value prop, category cards, "Start with Two Pointers"
    dsa/page.tsx             pattern grid, grouped (Foundations / Core / Trees & Graphs / Advanced) with progress
    dsa/[pattern]/page.tsx   pattern intro + filterable problem table
    dsa/[pattern]/[problem]/ problem page (tabs: Explanation; Practice later)
    dsa/load.ts              loadPattern/loadProblem: resolve URL slugs or notFound()
    system-design/page.tsx   coming soon + planned topics
  components/
    ui/                      shadcn/ui (radix-nova). Slider has thumbLabel/thumbValueText for a11y
    catalog/                 difficulty badge, path breadcrumb, problem table, hints, approach toggle, progress UI
    learn/                   LearnView, VideoStage (client-only Player), controls, scene list, transcript, takeaway
    site/                    header, Cmd/Ctrl+K command palette, theme toggle/provider
  content/
    catalog/                 categories, patterns/<slug>.ts, problems/<pattern>/<slug>.ts, index.ts
    storyboards/             hand-written storyboards + registry (index.ts)
      generated/             <pattern>/<slug>.json written by the generator + index.ts (regenerated, don't edit)
    legacy-redirects.ts      old /learn/<id> URLs (imported by next.config.ts)
  lib/
    catalog/                 Zod schemas, define*(), judgeOutput(), repository.ts (the only way pages read content)
    progress/                ProgressRepository (localStorage, memory fallback) + useProgress hook
    storyboard/              Zod schemas (source + resolved), defineStoryboard(), resolveStoryboard(),
                             validateStoryboard(), primitive catalog, timing/timeline helpers
    traces/                  deterministic instrumented solutions: <pattern>/<slug>.ts + registry (app code)
    generation/              OFFLINE ONLY: model adapter, prompts/, pipeline, cache, writer, CLI (never in the app)
  video/                     Remotion composition, scene renderer, primitives + registry, theme
  store/player-store.ts      Zustand: mirrors PlayerRef events, exposes toggle/seekTo
  hooks/                     useReducedMotion
scripts/generate-storyboards.ts   the generator CLI (tsx)
tests/                       Vitest specs (fixtures/drafts.ts builds a correct draft from any trace)
  reference-solutions/       test-only solve() per problem; never imported by src/ (a test enforces it)
```

Data flow: `content/storyboards/*.ts` or `generated/*.json` → `defineStoryboard()` / `loadStoryboard()` (parse the
source schema, run the bound trace, fill omitted values from it, parse the resolved schema; throws on invalid) →
`validateStoryboard()` in tests (trace check) → `LearnView` → `<Player component={StoryboardComposition}>` →
`TransitionSeries` of `SceneView`s → each element rendered by its registry component.

Key rules:

- **Pages read content only through `@/lib/catalog/repository`** (getPatterns, getProblem, getPatternStats,
  getSearchIndex, …). Never import `@/content/catalog` from UI code. When content moves to a database, only the
  repository changes (its functions become async; server components add `await`).
- **Types come from Zod.** Never hand-write a type that duplicates a schema; use `z.infer` / `z.input`. No `any`.
- **Timeline is shared.** `getSceneTimeline()` in `lib/storyboard/timing.ts` is the single source for scene start
  frames, cross-fade overlap (`TRANSITION_FRAMES`), and "current scene" boundaries. The composition, scene list,
  scrubber, and keyboard shortcuts all use it. Don't compute frame offsets anywhere else.
- **The Player is client-only.** It reads the clock while rendering, which breaks static prerendering under Cache
  Components. `VideoStage` is loaded with `next/dynamic({ ssr: false })` and owns the player-event wiring.
- **Video theme and motion are inputs.** `StoryboardComposition` takes `theme` ("light" | "dark") and `reducedMotion`
  as input props. Primitives use `useScene().palette` and the helpers in `video/animation.ts`. Under reduced motion
  springs become short fades and positional tweens are dropped. Cross-fades stay, so timing doesn't change.

## Content catalog

Three levels (plus pattern groups), each a Zod schema in `src/lib/catalog/schema.ts` (types via `z.infer`):

```ts
Category = { slug: "dsa" | "system-design", name, description, status: "available" | "coming-soon", plannedTopics[] }
Group    = { slug: "foundations" | "core" | "trees-graphs" | "advanced", name, summary, order }   // content/catalog/groups.ts
Pattern  = { slug, categorySlug, group, name, summary, whenToUse[] (recognition signals), coreIdea, typicalComplexity,
             order }                                                // order is global: the /dsa numbering
Problem  = {
  slug, patternSlug, title, difficulty: "easy" | "medium" | "hard", order,
  statement,                       // paragraphs split by blank lines; "- " lines → bullets; `code` → inline code
  examples: { input, output, explanation?, args: Json[], expected: Json }[],   // display text + machine-readable
  judge: "exact" | "unordered" | "unordered-nested" | "float",                 // how outputs are compared
  exampleFormat: "call" | "operations",                                        // "operations" for design problems
  constraints[], hints[] (ordered, progressive), keyIdea, complexity: { time, space },
  storyboardId?,                   // links a video from content/storyboards
  tags[], relatedPatterns: string[],   // cross-listing (below)
  externalRefs: { label, url }[],
}
```

- One file per pattern (`content/catalog/patterns/<slug>.ts`) and per problem
  (`content/catalog/problems/<pattern>/<slug>.ts`), each built with `definePattern()` / `defineProblem()`, which
  parse and throw a readable error. Content never lives in one giant file.
- **Original wording only.** Statements, examples, and hints are written for this project; never copy LeetCode or
  other sites. Well-known titles are fine, and `externalRefs` may link to the original.
- Each pattern has 4–5 problems with at least one easy, one medium, and one hard (tested). **Exception: Sorting** has
  one problem per algorithm ("Sort an Array with Merge Sort", …) plus Count Inversions, up to 8. Its statements
  require the named algorithm and its reference solutions implement it (tests only see outputs).
- **20 patterns in 4 groups**, in `/dsa` order:
  - Foundations: Arrays & Hashing, Prefix Sum, Sorting Algorithms, Bit Manipulation
  - Core patterns: Two Pointers, Fast & Slow Pointers, Sliding Window, Binary Search, Stack (incl. monotonic), Linked
    List, Intervals, Greedy
  - Trees & Graphs: Trees (DFS), Graphs (BFS), Heap / Priority Queue, Trie, Advanced Graphs (topological sort,
    Dijkstra, union-find)
  - Advanced: Backtracking, Dynamic Programming, Data Structure Design

  Folded in rather than separate: top-K (Heap), monotonic queue (Sliding Window), cyclic sort (Arrays & Hashing),
  matrix/grid traversal (Graphs), level-order (Trees). A test pins the list of 20.

- **Cross-listing.** A problem has one home (`patternSlug`: its URL and its progress key) and may list other patterns
  in `relatedPatterns`. Related patterns show it after their own problems with an "also in <home>" label, linking to
  the home URL; the problem page shows "also in …" links back. Stats and the E/M/H rule count own problems only
  (`getPatternStats().related` counts the rest). `getPatternListing()` builds a pattern's table. If a problem ever
  moves to a better home, add a permanent redirect from its old URL in `content/legacy-redirects.ts` (the routing
  test checks redirects land on live pages); progress for the old key is lost, so prefer `relatedPatterns`.
- **Design problems** (`exampleFormat: "operations"`): `args` is `[operations, arguments]`, e.g.
  `[["MinStack", "push", "getMin"], [[], [3], []]]`, the first operation constructs the object, and `expected` lists
  each return value (`null` for the constructor and void methods). `solve(operations, args)` replays them. The
  problem page renders an operation → output table (`components/catalog/examples.tsx`).
- Example data formats: linked lists are arrays (`[1, 2, 3]`); binary trees are level order with `null` for gaps and
  trailing nulls trimmed (`[3, 9, 20, null, null, 15, 7]`). Helpers: `tests/reference-solutions/_shared/`.

### Reference solutions

Every problem has `tests/reference-solutions/<pattern>/<slug>.ts` exporting `solve(...args)`, written independently
as the standard optimal approach. `tests/catalog-examples.test.ts` calls `solve(...example.args)` for every example
and compares with `example.expected` using the problem's `judge` (`judgeOutput` in `lib/catalog/judge.ts`). A wrong
hand-computed example fails the suite. Reference solutions are test-only: nothing in `src/` may import them.

### How to add a pattern

1. Create `src/content/catalog/patterns/<slug>.ts` with `definePattern({...})`: pick its `group` and an `order`
   that places it inside that group (orders are global and unique; renumber neighbours if needed).
2. Create `src/content/catalog/problems/<slug>/index.ts` exporting `<camel>Problems = [...]`, plus 4–5 problems.
3. Register both in `src/content/catalog/index.ts`. `/dsa`, `/dsa/<slug>`, the palette, and static params pick it up.
4. Add the slug to the "covers the planned 20 patterns" test in `tests/catalog.test.ts`.
5. Cross-list existing problems that also teach it (`relatedPatterns`), and tag its new problems the same way.

### How to add a problem

1. Write `src/content/catalog/problems/<pattern>/<slug>.ts` with `defineProblem({...})`: 2–3 examples (one edge
   case), exactly-defined output (what to return when nothing is found), 3 progressive hints, and a `judge` that
   makes the answer unique.
2. Add it to the pattern's `problems/<pattern>/index.ts`.
3. Write `tests/reference-solutions/<pattern>/<slug>.ts` exporting `solve`. Run `pnpm test`.

### How to attach a storyboard (video)

1. Build and register the storyboard (see "How to add a video" below). It must pass `validateStoryboard`.
2. Set `storyboardId: "<storyboard id>"` on the problem. The problem page renders the player; the table and cards
   show "video: yes". The catalog test validates every linked storyboard.
3. A storyboard's `trace.args` must equal one of the problem's examples (tested), so the video and the written
   example tell the same story. Generated storyboards don't need step 2: the repository finds them by problem key.
4. On the problem page, the video's takeaway card moves inside the "Show approach" toggle (`showTakeaway={false}`),
   so nothing spoils the approach before the learner asks.

## Progress

`lib/progress/repository.ts` defines `ProgressRepository` (`getSnapshot`, `set`, `subscribe`, `persistent`), keyed by
`"<pattern>/<slug>"` with statuses `not-started | learning | done`. Today it's `createLocalProgressRepository()`:
versioned JSON in localStorage, synced across tabs via the `storage` event, falling back to memory when storage is
missing or throws (private mode, blocked site data, quota). Components use `useProgress()` (a
`useSyncExternalStore` hook whose server snapshot is empty, so hydration always matches). To move to a database
after auth: implement the interface against an API and swap it in `use-progress.ts`; components don't change.

## Practice mode (planned, not built)

The problem page body is `ProblemTabs` with a single "Explanation" tab. Solving plugs in as a second tab:

1. **Content model.** Add optional `starterCode: { [language]: string }` and `testCases` to `problemSchema`. Example
   `args`/`expected` are already machine-readable and verified against reference solutions, so they become the
   visible test cases; add hidden cases the same way (`args`, `expected`, judged by `judgeOutput`).
2. **Practice tab.** Editor (e.g. Monaco/CodeMirror, client-only like the Player), language picker, Run (visible
   cases) and Submit (all cases), and a results panel. A "Done" result can update progress through
   `ProgressRepository`.
3. **Execution as a separate service.** Never run user code in the Next.js server. A sandboxed runner (isolated
   containers or a hosted judge) takes `{ language, code, cases, judge }`, runs with CPU/memory/time limits and no
   network, and returns per-case results. The app calls it from a rate-limited server route.
4. Reference solutions stay test-only: they verify the cases, they're never shipped to the client.
5. The machine-readable `args`/`expected` are the same foundation the trace system runs on, so a Practice tab can
   later show "your code vs. the trace" step by step.

## The storyboard

```ts
Storyboard = {
  id, title, concept, category: "dsa" | "system-design", summary, tags,
  exampleSource: "problem-native" | "analogy",
  analogy?: { scenario, mapping: { real, abstract }[] },   // required iff exampleSource === "analogy"
  takeaway: { pattern, summary, timeComplexity, spaceComplexity, whenToUse[] },
  trace?: { problem: "pattern/slug", args: unknown[] },   // binds scenes to a trace (src/lib/traces)
  generation?: { promptVersion, provider, model, generatedAt, repairAttempts },   // generated storyboards only
  scenes: Scene[],
}
Scene = { id, narration, caption (≤80 chars), durationInFrames, traceStep?, elements: Element[] }
```

Two forms of the same schema:

- **Source** (`storyboardSourceSchema`, `StoryboardInput`): what files and the model write. With a trace, the
  state-carrying values may be **omitted** and come from the scene's bound step: row values (`item-row.items` /
  `bar-row.bars`, with optional `labels`), pointer `index` (and `fromIndex`, from the previous bound step), equation
  `terms`/`operator`/`result`/`comparison`/`verdictTone`, highlight `indices`, bar `fill`/`water`, and a `result`'s `value` when
  `showsAnswer: true`. Any value that _is_ written is kept and checked against the trace.
- **Resolved** (`storyboardSchema`, `Storyboard`): every value present. `resolveStoryboard()` produces it;
  renderers and the validator only see this form.

- `narration` is what gets voiced. `caption` is the short on-screen headline.
- `durationInFrames` is currently `estimateDurationInFrames(narration)` (~150 wpm plus padding, 30 fps). Once audio
  exists, the audio clip's length replaces it. Nothing else needs to change because element timing is relative (below).
- Schema-level checks (in `superRefine`): unique scene/element ids, and every `rowId`/index reference points at an
  existing item-row or bar-row and an in-range item.

## Primitives

`Element` is a Zod discriminated union on `type`. Every element has `id` and `enterAt` (0–1, a **fraction** of the
scene's duration, so timing survives the switch to audio-driven lengths).

| type            | purpose                                                                                                                                                              | slot   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `item-row`      | labeled cards with values (product + price, `a[i]` + value, a character)                                                                                             | canvas |
| `bar-row`       | vertical bars on a baseline; optional container `fill`, per-bar `water`, `moves` (bars slide; a swap arcs), `empty` (dashed slots), `maxValue` (one scale per video) | canvas |
| `pointer`       | named marker on an item; `fromIndex` makes it slide; `binds` ties it to a trace pointer                                                                              | canvas |
| `highlight`     | emphasize items: `active` / `rejected` / `found` (glyph + word + border style, never color alone)                                                                    | canvas |
| `callout`       | speech bubble; anchored to an item or floating at the top                                                                                                            | canvas |
| `equation`      | `terms` joined by `operator` (+, −, ×), `result`, optional `comparison`, `verdict` + `verdictTone`                                                                   | bottom |
| `result`        | final answer / stat card; `showsAnswer` / `indices` checked against the trace                                                                                        | bottom |
| `sorted-region` | positions in final order: shaded band + baseline segment, "✓ sorted" label beside the row                                                                            | canvas |
| `held-value`    | a value lifted out of the row (insertion sort's key) in a strip above its gap                                                                                        | canvas |
| `count-array`   | tally panel under the bars, one cell per key; the changed cell gets a thick border and ▲                                                                             | canvas |

`src/video/primitives/registry.ts` maps each type to `{ component, slot, layer }`. Its type is
`{ [K in ElementType]: PrimitiveDefinition<K> }`, so **a schema variant without a renderer fails typecheck**.
Canvas primitives are absolutely positioned on the 1280×720 stage using `useScene().rows` (from
`video/layout.ts`). Bottom-slot primitives stack in storyboard order under the rows.

### How to add a primitive

1. **Schema**: in `src/lib/storyboard/elements.ts`, define the resolved `fooElementSchema` and a `fooSourceSchema`
   (trace-derivable fields optional), and append them to `elementSchemas` / `elementSourceSchemas`. Export
   `FooElement = ElementOf<"foo">`. Describe it in `primitive-catalog.ts` (typed: the generator prompt reads it).
2. **Cross-references**: if it references rows or items, add a case to the `superRefine` in `schema.ts`.
3. **Component**: create `src/video/primitives/Foo.tsx` taking `{ element: FooElement }`. Use `useScene()` for
   palette, row layout, and `reducedMotion`, and `enterProgress()`/`motion()` for animation. `useCurrentFrame()` is
   already local to the element's entrance (it's wrapped in a `<Sequence from={enterAt * duration}>`).
4. **Register**: add `foo: { component: Foo, slot, layer }` to `primitiveRegistry` (typecheck fails until you do).
   If it needs its own region (for example a staircase replacing the row band), extend `layout.ts`.
5. **Resolve + validate**: if it carries algorithm state, fill it from the step in `resolve.ts` and check it in
   `validate.ts` (and add the state to `TraceStep` if it's new).
6. **Test**: add a schema test and, if validated, a "wrong storyboard fails" test.

Existing primitives and storyboards never change when one is added.

**Verdict colors.** An equation's `verdict` pill is colored by `verdictTone` (positive → success, negative →
danger, neutral → muted). Without a tone it falls back to the comparison sign (`<` info, `>` danger, `=` success),
the "too low / too high / found" convention of the pair-sum and Three Sum videos. When the sign would mislead, the
trace sets `equation.tone` and bound equations inherit it (Container With Most Water: a new best is `>` but positive,
a worse area is neutral; Trapping Rain Water: water held is positive, none is neutral). Logic: `verdictColor()` in
`video/theme.ts`.

**Sorting** (bubble, selection, insertion, counting) extended this: steps carry `values` (the array after the step),
and the resolver draws a bound scene's bars from it; every bar-row in those videos shares `maxValue`, the largest
value the trace ever holds. A single-term equation renders as a comparison (`7 > 3`, no `= 7`); sorting traces set
`tone` on every comparison (bubble: out of order negative, in order positive; selection: new minimum positive,
otherwise neutral; insertion: shift neutral, found its place positive). The layout gives a held value its own strip
above the bars (anchored callouts sit above that, via `RowLayout.reservedTop`) and shortens the bars when a scene
has a count-array.

`bar-row` was added this way for Container With Most Water and Trapping Rain Water. Planned primitives (not built):
`staircase` (Climbing Stairs), `house-row` (House Robber), `coin-set` (Coin Change), `box-arrow` (system design).

## Traces and validation

`src/lib/traces/<pattern>/<slug>.ts` is an **instrumented solution**: a pure function that runs the algorithm on one
input and returns a `Trace` (types in `traces/types.ts`):

```ts
Trace = {
  problem: "pattern/slug", row: { values, display: "cards" | "bars" }, pointerNames,
  steps: { kind, key, pointers: { left: 0, right: 6 }, note, equation?, active?, rejected?, found?, fill?, water?,
           values?, moves?, empty?, sorted?, held?, counts? }[],   // the last six: algorithms that rearrange the array
  //   equation = { terms, operator, result, comparison?: { op, target }, tone?: "positive" | "negative" | "neutral" }
  answer,             // same shape as the reference solution's return value (tested)
  answerDisplay,      // what a `showsAnswer` result must show, e.g. "[2, 5]", "true", "11"
  answerIndices?,     // when the answer is a set of positions
}
```

Each file also exports a `TraceDefinition` (`exampleIndex`: which catalog example the video animates;
`exampleSource`: "problem-native" or "analogy"; a Zod `args` tuple that also caps input size so it fits on screen).
`traces/index.ts` registers them; `runTrace(problem, args)` validates args and runs. Trace code is **app code** (the
video resolves values from it); reference solutions stay test-only.

**Key steps** (`key: true`) are the decisions a video must show; others may happen off-screen. Choose them so a video
fits in 10 scenes (≈ key steps + 3). The last step is always key.

`validateStoryboard(storyboard)` returns `{ ok, issues[] }`:

- Always: every equation's arithmetic (with its operator) and comparison must be true.
- With `trace`: every `traceStep` exists and they never decrease; every key step is bound by some scene; rows used
  by bound pointers/highlights hold the trace's values; bound pointers sit where the step says (and slide from where
  the previous bound step left them); pointers only bind names the step has; equations equal the step's equation (and its `tone`, if it sets one);
  highlights equal the step's active/rejected/found items; bar fills and water match; in a bound scene, rows hold the
  step's own array when it has one (`values`), and moves, empty slots, sorted regions, held values, and tallies
  match the step; `result.indices` equal
  `answerIndices`, a `showsAnswer` result displays exactly `answerDisplay`, and the answer is revealed somewhere.

The hand-written Two Pointers storyboard is bound to `two-pointers/pair-with-target-sum` and passes the same checks.

### How to make a problem generatable

1. Write `src/lib/traces/<pattern>/<slug>.ts`: the same algorithm as the reference solution, recording a step per
   decision with a one-sentence `note`, the state snapshot, and `key` on the decisions worth a scene. Export a
   `TraceDefinition` (pick a small example; add one to the problem if none fits on screen).
2. Register it in `src/lib/traces/index.ts`. `tests/traces.test.ts` then checks its answer against the reference
   solution on every example that fits, and `tests/trace-storyboards.test.ts` checks a fixture storyboard built from
   it resolves and validates.
3. If the visual needs a new primitive (bars, a staircase…), add it (above).
4. Run `pnpm generate:storyboards --problem <pattern>/<slug> --dry-run`, then without `--dry-run`.

### How to add a video by hand

1. Make the problem generatable (above), or reuse its trace.
2. Write `src/content/storyboards/<id>.ts` with `defineStoryboard({...})`, 6–10 scenes, `trace` set and
   `traceStep` on every scene that shows a move. Use the `scene()` helper so `durationInFrames` comes from the
   narration. Prefer omitting trace-derived values over writing them.
3. Register it in `src/content/storyboards/index.ts`, then attach it with `storyboardId` (above).
4. Add tests: it passes the schema, it passes the validator, and a mutated copy fails.

Recommended arc: the problem in real-life terms → why brute force is slow → the key idea → a few moves with the
reasoning → the answer → a closing scene mapping back to the general pattern and its complexity.

## Generating storyboards (offline)

`pnpm generate:storyboards` runs `scripts/generate-storyboards.ts` locally. It is never called by the app: an ESLint
rule and a test forbid importing `@/lib/generation`, `ai`, or `@ai-sdk/*` from app code.

```bash
pnpm generate:storyboards --pattern two-pointers --dry-run   # validate and print, write nothing
pnpm generate:storyboards --problem two-pointers/three-sum   # one problem
pnpm generate:storyboards --missing                          # every generatable problem without a storyboard
#   --force             regenerate even if a storyboard exists, ignoring the cache (hand-written ones never change)
#   --max-requests <n>  stop after n model calls, counting repairs and retries (default 15)
```

Per problem: skip if it has a storyboard (unless `--force`) or no trace → reuse a valid cache entry → otherwise call
the model (`generateText` + `Output.object` with `draftSchema`) with the problem, the numbered trace (key steps
marked), the primitive catalog, and the "Choosing the example" rule → `evaluateDraft()` (draft schema, assembly,
source schema, resolution, `validateStoryboard`, exampleSource rule) → on failure send the exact issues back, up to
**2 repairs** → cache it and write `generated/<pattern>/<slug>.json`, regenerating `generated/index.ts`. The
repository serves it for that problem automatically. A summary table lists result, repairs, scenes, and requests.

- **Prompts** live in `src/lib/generation/prompts/` as typed template functions with a `PROMPT_VERSION`
  (`pnpm storyboards:prompt <pattern>/<slug>` prints the rendered prompt). Bump it on
  any wording change. The version, provider, and model are recorded in each storyboard's `generation` metadata.
- **Cache**: `.cache/generation/<pattern>/<slug>.json` (gitignored), keyed by problem + prompt version + trace hash.
  Dry runs fill it too, so a real run after a dry run makes no requests. A changed prompt or trace makes it stale.
- **Quotas** (Gemini free tier ≈ 20 requests/day): `GENERATION_DELAY_MS` (default 10s) between requests. Per-minute
  429s, temporary overloads (503/529), timeouts (`GENERATION_TIMEOUT_MS`, default 2 min), and dropped connections
  retry with exponential backoff (20s, 40s, 80s, or the provider's `retryDelay`), max 3. If it's still failing after
  that, the run stops ("unavailable") instead of repeating the same waits for every remaining problem. A **daily** quota error (Gemini's `…PerDay…` quota id) is not retried: the run stops, keeps
  everything cached or saved, lists what remains, and says to rerun with `--missing`. `--max-requests` caps total
  calls.
- **Tests** never call a real API: the pipeline takes injected `model`, `cache`, `writer`, `sleep`, and `log`, and
  the AI SDK adapter is tested with `MockLanguageModelV4`.

### Exit codes (both commands)

`0`: every targeted problem ended saved, cached, valid (dry run), or skipped. `1`: at least one failed (invalid after
repairs, or an error). `2`: the run stopped early (budget, daily quota, or model unavailable) with problems left. The
last line says why. Logic: `exitStatus()` in `src/lib/generation/report.ts`.

### Authoring fallback (Claude Code writes the draft)

When no model is available, a coding agent (or a person) can author the draft instead, against the same prompt and
the same checks:

```bash
pnpm storyboards:prompt two-pointers/three-sum > .cache/drafts/two-pointers/three-sum.prompt.md   # exact instructions
# write the draft JSON (the model's format) to .cache/drafts/two-pointers/three-sum.json, then:
pnpm storyboards:validate-draft .cache/drafts/two-pointers/*.json --dry-run --model claude-opus-5-5
pnpm storyboards:validate-draft .cache/drafts/two-pointers/*.json --model claude-opus-5-5          # save
```

- Drafts live in `.cache/drafts/<pattern>/<slug>.json` (gitignored); the problem comes from the path. Only validated
  storyboards reach `src/`.
- Each issue is located (`scene "too-low" › element "sum" › terms`) with expected vs. actual values. Schema errors in
  text fields (an over-long caption) don't hide the trace checks; both are reported in one pass. The generator's
  repair prompts get the same located issues.
- Valid drafts are saved exactly like generated ones (JSON, regenerated registry, cache entry) with
  `generation.provider: "claude-code"`, `model` from `--model` (default `claude-code`), the prompt version, and
  `repairAttempts` = failed validations before it passed (counted in `.cache/drafts/attempts.json`, dry runs included).
  The generator's `--missing` then treats the problem as done.
- Hand-written storyboards are never replaced; an existing generated one only with `--force`.
- Generated JSON is in `.prettierignore`: the writer owns its formatting.

### Provider config

Set in `.env.local` (gitignored; see `.env.example`). Never print, log, or commit key values.

| var                            | default                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `AI_PROVIDER`                  | `google` (or `anthropic`)                                  |
| `AI_MODEL`                     | `gemini-3.8-flash` (google), `claude-opus-5-5` (anthropic) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | required for `google`                                      |
| `ANTHROPIC_API_KEY`            | required for `anthropic`                                   |
| `GENERATION_DELAY_MS`          | `10000`                                                    |
| `GENERATION_TIMEOUT_MS`        | `120000` (a timed-out request is retried like an overload) |

The script fails fast, naming the missing variable, if the selected provider's key isn't set.

## Choosing the example

`exampleSource` decides where the real-world example comes from. The schema enforces it.

- **`"problem-native"`**: the problem statement already describes a real-world scenario (Climbing Stairs, House
  Robber, Coin Change, Trapping Rain Water, Best Time to Buy and Sell Stock). The storyboard **must** use that exact
  scenario, its wording, and its numbers. **No substitute analogy**, and `analogy` must be omitted.
- **`"analogy"`**: the problem is abstract (arrays, pointers, linked lists, matrices). Use one relatable real-world
  analogy, describe it in `analogy.scenario` and `analogy.mapping`, and make the **closing scene map it back** to the
  abstract problem (e.g. relabel items as `a[i]`, pointers as `left`/`right`).

Two Pointers is `"analogy"`: a price-sorted shelf where you and a friend spend a $50 gift card exactly. The sorting
videos each use a different analogy: cousins lining up by age (bubble), parcels loaded lightest first (selection), a
hand of playing cards (insertion), and tallying star ratings (counting).

The UI shows a badge: "Real-world problem" (problem-native) or "Explained with an analogy".

## UI conventions

- **Look: a calm developer tool.** Neutral palette, thin borders, generous whitespace, no gradients or emoji. One
  accent: **indigo** (`--primary`/`--ring` in `globals.css`, `primary` in `video/theme.ts`). Don't add a second hue.
- **Type:** Geist Sans for prose; Geist Mono for labels, metadata, breadcrumbs (`dsa / two-pointers / …`),
  complexity, examples, and shortcut hints (`<Kbd>`). Section labels are lowercase mono (`core idea`, `examples`).
- **Difficulty** is a muted badge: the word plus a 1–3 bar meter, never color alone. **Status** is a glyph plus a word
  (○ Not started, ◐ Learning, ● Done).
- Render content strings with `<InlineText>` / `<RichText>` (`components/catalog/rich-text.tsx`) so `backticks`
  become code. Content never contains HTML.
- Tables become stacked cards below `md`. Visible focus rings everywhere (`:focus-visible` in `globals.css`).
- **Theme: dark by default** for first-time visitors, whatever the OS prefers (`site/theme-provider.tsx`,
  next-themes with `defaultTheme="dark"`, `enableSystem={false}`). The choice is stored in localStorage (`theme`) and
  applied by next-themes' blocking script before first paint, so there's no flash. The header toggle
  (`site/theme-toggle.tsx`) shows on every page and screen size, with an aria-label and tooltip "Switch to light/dark
  mode" (set after hydration, since the server doesn't know the stored theme); the palette has a "Toggle theme"
  action using the same `useThemeSwitch()`. The video gets the theme as an input prop from `LearnView`. Text must pass
  4.5:1 in both themes, including muted text on `--muted` surfaces (checked with axe on every page).
- Cmd/Ctrl+K opens the command palette (`site/command-palette.tsx`, cmdk with a custom word-substring filter): pattern
  groups (jump to `/dsa#<group>`), patterns (with their group), problems, and the "Toggle theme" action.
- shadcn/ui components live in `src/components/ui`. They import `cn` from the `cn` package (shadcn's own) via
  `@/lib/utils`.
- Accessibility: every icon button has an `aria-label` (and `aria-keyshortcuts` when there's a shortcut). The
  scrubber thumb has `aria-valuetext`. The current scene uses `aria-current="step"` plus a "Now playing" text marker,
  and a polite live region announces scene changes. Item states always pair color with a glyph and a word.
- Keyboard (window-level, ignored while focus is in a button, slider, select, or input): Space play/pause, ←/→ seek
  5s, Shift+←/→ previous/next scene, F fullscreen.
- Respect `prefers-reduced-motion` in both the UI (`motion-reduce:` plus the global CSS rule) and the video
  (`reducedMotion` input prop).

## Roadmap

1. **More generated videos.** Offline generation exists (above) and is proven on Two Pointers. Next: traces for the
   other patterns (and the primitives they need), then runtime generation for custom questions behind a server
   route with rate limits, reusing the same pipeline and validator.
2. **ElevenLabs narration.** Voice each scene's `narration`, store the audio, set `durationInFrames` from the clip
   length (plus padding), and add an `<Audio>` per scene in `SceneView`. Element `enterAt` fractions keep animations
   aligned. Later, use word timestamps to time callouts and equations.
3. **Database, auth, and custom questions.** Move the catalog and storyboards behind the repository into a database,
   move progress to a server-backed `ProgressRepository` after auth, and let users paste their own question.
4. **Practice mode.** See "Practice mode (planned)" above.
5. **System design explainers.** `box-arrow` primitive (services, queues, caches, arrows with animated requests),
   plus traces/validators for things like consistent hashing, rate limiters, and load balancing.
6. **Rate limiting.** Per-user and per-IP limits on generation and narration endpoints (both cost money), plus
   caching identical requests.
7. Planned DSA primitives: `staircase`, `house-row`, `coin-set`, with their traces.

## Gotchas

- **Next.js 16 with Cache Components**: `generateStaticParams` must return at least one param and `dynamicParams` is
  not allowed. `/dsa/[pattern]` and `/dsa/[pattern]/[problem]` export `ensureStatic = "navigation"` so unknown slugs
  render fully and `notFound()` returns a real 404 (otherwise Partial Prefetching serves the fallback shell with a
  200). Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- **Read `params` inside `<Suspense>`.** The App Shell is shared by every link to a dynamic route, so awaiting
  `params` at the top of a page triggers "URL data outside of Suspense" in dev. Pages render static chrome, then a
  Suspense child that awaits `params`. Links into these routes use `prefetch={true}` so the click is still instant.
- **`next.config.ts` can't resolve `@/` imports.** That's why redirects live in the dependency-free
  `content/legacy-redirects.ts` (and `tests/routing.test.ts` checks them against the catalog).
- **shadcn's `CommandDialog` doesn't include `<Command>`.** Wrap the items in `<Command>` yourself or cmdk throws
  ("reading 'subscribe'") as soon as the dialog opens.
- **pnpm's minimum release age.** pnpm refuses packages published in the last day. Don't pin a brand-new version
  (pnpm then writes an exemption into `pnpm-workspace.yaml`); pick one a few days old. `esbuild` (via `tsx`) is
  listed under `allowBuilds: false` like `sharp`, otherwise `pnpm install --frozen-lockfile` fails on Vercel.
- **AI SDK v7**: `generateObject` is deprecated; use `generateText` with `output: Output.object({ schema })`. Pass
  `maxRetries: 0` so our own backoff (logged, budgeted) is the only retry layer.
- After deleting a route, `pnpm typecheck` can fail on stale `.next/dev/types`. Stop `pnpm dev` and remove
  `.next/dev`.
- **Keep the repo out of iCloud-synced folders** (Desktop/Documents). macOS can evict `node_modules` files, and
  every tool hangs.
- Remotion requires a company license for teams of 4+ people. See https://remotion.dev/license.
