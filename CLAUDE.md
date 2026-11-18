@AGENTS.md

# algovizlib

A web app that teaches computer science concepts (DSA first, then system design) through a curated **catalog**
(category → pattern → problem) and short animated videos. Each video explains the **approach** through a concrete
real-world example, not a line-by-line code walkthrough. Narration will be voiced with ElevenLabs later.

Every video is driven by a **storyboard**: plain, typed data. Today storyboards are hand-written. Later Claude will
generate them, and they will go through the same schema and engine validator before anyone sees them.

## Commands

```bash
pnpm dev          # http://localhost:3000
pnpm lint         # ESLint (next + typescript + prettier compat)
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # Vitest
pnpm build        # production build (static prerender)
pnpm format       # Prettier
```

Run `lint`, `typecheck`, `test`, and `build` before committing.

## Architecture

```
src/
  app/                       Next.js App Router (Cache Components + Partial Prefetching are on)
    page.tsx                 landing: value prop, category cards, "Start with Two Pointers"
    dsa/page.tsx             pattern grid
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
    legacy-redirects.ts      old /learn/<id> URLs (imported by next.config.ts)
  lib/
    catalog/                 Zod schemas, define*(), judgeOutput(), repository.ts (the only way pages read content)
    progress/                ProgressRepository (localStorage, memory fallback) + useProgress hook
    storyboard/              Zod schemas → inferred types, defineStoryboard(), timing/timeline helpers
    engines/                 deterministic algorithm engines + validateStoryboard()
  video/                     Remotion composition, scene renderer, primitives + registry, theme
  store/player-store.ts      Zustand: mirrors PlayerRef events, exposes toggle/seekTo
  hooks/                     useReducedMotion
tests/                       Vitest specs
  reference-solutions/       test-only solve() per problem; never imported by src/ (a test enforces it)
```

Data flow: `content/*.ts` → `defineStoryboard()` (Zod parse, applies defaults, throws on invalid) →
`validateStoryboard()` in tests (engine check) → `LearnView` → `<Player component={StoryboardComposition}>` →
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

Three levels, each a Zod schema in `src/lib/catalog/schema.ts` (types via `z.infer`):

```ts
Category = { slug: "dsa" | "system-design", name, description, status: "available" | "coming-soon", plannedTopics[] }
Pattern  = { slug, categorySlug, name, summary, whenToUse[] (recognition signals), coreIdea, typicalComplexity, order }
Problem  = {
  slug, patternSlug, title, difficulty: "easy" | "medium" | "hard", order,
  statement,                       // paragraphs split by blank lines; "- " lines → bullets; `code` → inline code
  examples: { input, output, explanation?, args: Json[], expected: Json }[],   // display text + machine-readable
  judge: "exact" | "unordered" | "unordered-nested" | "float",                 // how outputs are compared
  constraints[], hints[] (ordered, progressive), keyIdea, complexity: { time, space },
  storyboardId?,                   // links a video from content/storyboards
  tags[], externalRefs: { label, url }[],
}
```

- One file per pattern (`content/catalog/patterns/<slug>.ts`) and per problem
  (`content/catalog/problems/<pattern>/<slug>.ts`), each built with `definePattern()` / `defineProblem()`, which
  parse and throw a readable error. Content never lives in one giant file.
- **Original wording only.** Statements, examples, and hints are written for this project; never copy LeetCode or
  other sites. Well-known titles are fine, and `externalRefs` may link to the original.
- Each pattern has 4–5 problems with at least one easy, one medium, and one hard (tested).
- Example data formats: linked lists are arrays (`[1, 2, 3]`); binary trees are level order with `null` for gaps and
  trailing nulls trimmed (`[3, 9, 20, null, null, 15, 7]`). Helpers: `tests/reference-solutions/_shared/`.

### Reference solutions

Every problem has `tests/reference-solutions/<pattern>/<slug>.ts` exporting `solve(...args)`, written independently
as the standard optimal approach. `tests/catalog-examples.test.ts` calls `solve(...example.args)` for every example
and compares with `example.expected` using the problem's `judge` (`judgeOutput` in `lib/catalog/judge.ts`). A wrong
hand-computed example fails the suite. Reference solutions are test-only: nothing in `src/` may import them.

### How to add a pattern

1. Create `src/content/catalog/patterns/<slug>.ts` with `definePattern({...})` (pick the next `order`).
2. Create `src/content/catalog/problems/<slug>/index.ts` exporting `<camel>Problems = [...]`, plus 4–5 problems.
3. Register both in `src/content/catalog/index.ts`. `/dsa`, `/dsa/<slug>`, the palette, and static params pick it up.

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
3. If the storyboard is bound to an engine, one of the problem's examples must use the storyboard's exact input
   (tested for `two-pointers`), so the video and the written example tell the same story.
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

## The storyboard

```ts
Storyboard = {
  id, title, concept, category: "dsa" | "system-design", summary, tags,
  exampleSource: "problem-native" | "analogy",
  analogy?: { scenario, mapping: { real, abstract }[] },   // required iff exampleSource === "analogy"
  takeaway: { pattern, summary, timeComplexity, spaceComplexity, whenToUse[] },
  engine?: { name: "two-pointers", input: { values, target } },  // enables engine validation
  scenes: Scene[],
}
Scene = { id, narration, caption (≤80 chars), durationInFrames, elements: Element[] }
```

- `narration` is what gets voiced. `caption` is the short on-screen headline.
- `durationInFrames` is currently `estimateDurationInFrames(narration)` (~150 wpm plus padding, 30 fps). Once audio
  exists, the audio clip's length replaces it. Nothing else needs to change because element timing is relative (below).
- Schema-level checks (in `superRefine`): unique scene/element ids, and every `rowId`/index reference points at an
  existing item-row and an in-range item.

## Primitives

`Element` is a Zod discriminated union on `type`. Every element has `id` and `enterAt` (0–1, a **fraction** of the
scene's duration, so timing survives the switch to audio-driven lengths).

| type        | purpose                                                                                           | slot   |
| ----------- | ------------------------------------------------------------------------------------------------- | ------ |
| `item-row`  | labeled cards with values (product + price, `a[i]` + value)                                       | canvas |
| `pointer`   | named marker on an item; `fromIndex` makes it slide; `binds` ties it to an engine variable        | canvas |
| `highlight` | emphasize items: `active` / `rejected` / `found` (glyph + word + border style, never color alone) | canvas |
| `callout`   | speech bubble; anchored to an item or floating at the top                                         | canvas |
| `equation`  | `terms`, `result`, optional `comparison` vs target, `verdict` word                                | bottom |
| `result`    | final answer / stat card (`indices` checked against engine)                                       | bottom |

`src/video/primitives/registry.ts` maps each type to `{ component, slot, layer }`. Its type is
`{ [K in ElementType]: PrimitiveDefinition<K> }`, so **a schema variant without a renderer fails typecheck**.
Canvas primitives are absolutely positioned on the 1280×720 stage using `useScene().rows` (from
`video/layout.ts`). Bottom-slot primitives stack in storyboard order under the rows.

### How to add a primitive

1. **Schema**: in `src/lib/storyboard/elements.ts`, define `fooElementSchema = z.object({ ...baseElement, type:
z.literal("foo"), ... })` and append it to `elementSchemas`. Export `FooElement = ElementOf<"foo">`.
2. **Cross-references**: if it references rows or items, add a case to the `superRefine` in `schema.ts`.
3. **Component**: create `src/video/primitives/Foo.tsx` taking `{ element: FooElement }`. Use `useScene()` for
   palette, row layout, and `reducedMotion`, and `enterProgress()`/`motion()` for animation. `useCurrentFrame()` is
   already local to the element's entrance (it's wrapped in a `<Sequence from={enterAt * duration}>`).
4. **Register**: add `foo: { component: Foo, slot, layer }` to `primitiveRegistry` (typecheck fails until you do).
   If it needs its own region (for example a staircase replacing the row band), extend `layout.ts`.
5. **Validate**: if it carries algorithm state, check it in the relevant engine validator.
6. **Test**: add a schema test and, if validated, a "wrong storyboard fails" test.

Existing primitives and storyboards never change when one is added.

Planned primitives (not built): `staircase` (Climbing Stairs), `house-row` (House Robber), `coin-set` (Coin Change),
`box-arrow` (system-design boxes and connections).

## Engines and validation

`src/lib/engines/` holds pure, deterministic implementations that return the **exact move sequence**.
`twoPointers(values, target)` returns `{ steps, states, pair }`.

`validateStoryboard(storyboard)` returns `{ ok, issues[] }`:

- Always: every equation's arithmetic and comparison must be true.
- With `engine: { name: "two-pointers" }`: rows referenced by bound pointers must hold the engine's input values.
  Each scene's `left`/`right` pointers (`binds`) must sit on a state the algorithm visits. `fromIndex → index` may
  advance at most one step, and steps can't go backwards or happen off-screen. Equations must add the pointed-at
  values with the engine's comparison. `found` highlights and `result.indices` must equal the engine's pair, and
  the pair must be revealed somewhere.

AI-generated storyboards must pass both `storyboardSchema` and `validateStoryboard` before they're stored or shown.

### How to add a video

1. If it needs a new algorithm, add `src/lib/engines/<name>.ts` (pure function returning the move sequence) with
   tests covering found, not found, duplicates, and minimum input.
2. Add a variant to `engineBindingSchema` in `lib/storyboard/schema.ts` and a `case` in `validateStoryboard`.
3. Add any new primitives (see above).
4. Write `src/content/storyboards/<id>.ts` with `defineStoryboard({...})`, 6–9 scenes. Use the `scene()` helper
   pattern so `durationInFrames` comes from the narration.
5. Register it in `src/content/storyboards/index.ts`, then attach it to a problem with `storyboardId` (above).
6. Add tests: it passes the schema, it passes the validator, and a mutated copy fails.

Recommended arc: the problem in real-life terms → why brute force is slow → the key idea → a few moves with the
reasoning → the answer → a closing scene mapping back to the general pattern and its complexity.

## Choosing the example

`exampleSource` decides where the real-world example comes from. The schema enforces it.

- **`"problem-native"`**: the problem statement already describes a real-world scenario (Climbing Stairs, House
  Robber, Coin Change, Trapping Rain Water, Best Time to Buy and Sell Stock). The storyboard **must** use that exact
  scenario, its wording, and its numbers. **No substitute analogy**, and `analogy` must be omitted.
- **`"analogy"`**: the problem is abstract (arrays, pointers, linked lists, matrices). Use one relatable real-world
  analogy, describe it in `analogy.scenario` and `analogy.mapping`, and make the **closing scene map it back** to the
  abstract problem (e.g. relabel items as `a[i]`, pointers as `left`/`right`).

Two Pointers is `"analogy"`: a price-sorted shelf where you and a friend spend a $50 gift card exactly.

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
- Cmd/Ctrl+K opens the command palette (`site/command-palette.tsx`, cmdk with a custom word-substring filter).
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

1. **AI storyboard generation with Claude.** A server route takes a problem (from the library or custom), calls
   Claude with the storyboard JSON schema (`z.toJSONSchema(storyboardSchema)`), the primitive catalog, and the
   "Choosing the example" rule. Parse with Zod, run `validateStoryboard`, and feed issues back to Claude for repair
   until it passes. Abstract problems need an engine binding before they're accepted.
2. **ElevenLabs narration.** Voice each scene's `narration`, store the audio, set `durationInFrames` from the clip
   length (plus padding), and add an `<Audio>` per scene in `SceneView`. Element `enterAt` fractions keep animations
   aligned. Later, use word timestamps to time callouts and equations.
3. **Database, auth, and custom questions.** Move the catalog and storyboards behind the repository into a database,
   move progress to a server-backed `ProgressRepository` after auth, and let users paste their own question.
4. **Practice mode.** See "Practice mode (planned)" above.
5. **System design explainers.** `box-arrow` primitive (services, queues, caches, arrows with animated requests),
   plus engines/validators for things like consistent hashing, rate limiters, and load balancing.
6. **Rate limiting.** Per-user and per-IP limits on generation and narration endpoints (both cost money), plus
   caching identical requests.
7. More videos for catalog problems. Planned DSA primitives: `staircase`, `house-row`, `coin-set`, with their engines.

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
- After deleting a route, `pnpm typecheck` can fail on stale `.next/dev/types`. Stop `pnpm dev` and remove
  `.next/dev`.
- **Keep the repo out of iCloud-synced folders** (Desktop/Documents). macOS can evict `node_modules` files, and
  every tool hangs.
- Remotion requires a company license for teams of 4+ people. See https://remotion.dev/license.
