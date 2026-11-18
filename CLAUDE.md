@AGENTS.md

# algovizlib

A web app that turns computer science concepts (DSA first, then system design) into short animated videos. Each
video explains the **approach** through a concrete real-world example, not a line-by-line code walkthrough.
Narration will be voiced with ElevenLabs later.

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
    page.tsx                 landing: value prop + problem card grid
    learn/[id]/page.tsx      player page, statically generated from the content registry
  components/
    ui/                      shadcn/ui (radix-nova). Slider has thumbLabel/thumbValueText for a11y
    learn/                   LearnView, VideoStage (client-only Player), controls, scene list, transcript, takeaway
    site/                    header, theme toggle/provider, problem card
  content/storyboards/       hand-written storyboards + registry (index.ts)
  lib/
    storyboard/              Zod schemas → inferred types, defineStoryboard(), timing/timeline helpers
    engines/                 deterministic algorithm engines + validateStoryboard()
  video/                     Remotion composition, scene renderer, primitives + registry, theme
  store/player-store.ts      Zustand: mirrors PlayerRef events, exposes toggle/seekTo
  hooks/                     useReducedMotion
tests/                       Vitest specs
```

Data flow: `content/*.ts` → `defineStoryboard()` (Zod parse, applies defaults, throws on invalid) →
`validateStoryboard()` in tests (engine check) → `LearnView` → `<Player component={StoryboardComposition}>` →
`TransitionSeries` of `SceneView`s → each element rendered by its registry component.

Key rules:

- **Types come from Zod.** Never hand-write a type that duplicates a schema; use `z.infer` / `z.input`. No `any`.
- **Timeline is shared.** `getSceneTimeline()` in `lib/storyboard/timing.ts` is the single source for scene start
  frames, cross-fade overlap (`TRANSITION_FRAMES`), and "current scene" boundaries. The composition, scene list,
  scrubber, and keyboard shortcuts all use it. Don't compute frame offsets anywhere else.
- **The Player is client-only.** It reads the clock while rendering, which breaks static prerendering under Cache
  Components. `VideoStage` is loaded with `next/dynamic({ ssr: false })` and owns the player-event wiring.
- **Video theme and motion are inputs.** `StoryboardComposition` takes `theme` ("light" | "dark") and `reducedMotion`
  as input props. Primitives use `useScene().palette` and the helpers in `video/animation.ts`. Under reduced motion
  springs become short fades and positional tweens are dropped. Cross-fades stay, so timing doesn't change.

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

### How to add a problem

1. If it needs a new algorithm, add `src/lib/engines/<name>.ts` (pure function returning the move sequence) with
   tests covering found, not found, duplicates, and minimum input.
2. Add a variant to `engineBindingSchema` in `lib/storyboard/schema.ts` and a `case` in `validateStoryboard`.
3. Add any new primitives (see above).
4. Write `src/content/storyboards/<id>.ts` with `defineStoryboard({...})`, 6–9 scenes. Use the `scene()` helper
   pattern so `durationInFrames` comes from the narration.
5. Register it in `src/content/storyboards/index.ts`. The landing grid and `/learn/<id>` pick it up automatically.
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
3. **Problem library and custom questions.** Persist storyboards (database), add search/filter on the landing grid
   (category, tags, exampleSource), and let users paste their own question.
4. **System design explainers.** `box-arrow` primitive (services, queues, caches, arrows with animated requests),
   plus engines/validators for things like consistent hashing, rate limiters, and load balancing.
5. **Rate limiting.** Per-user and per-IP limits on generation and narration endpoints (both cost money), plus
   caching identical requests.
6. Planned DSA primitives: `staircase`, `house-row`, `coin-set`, with their engines.

## Gotchas

- **Next.js 16 with Cache Components**: `generateStaticParams` must return at least one param and `dynamicParams` is
  not allowed. `/learn/[id]` exports `ensureStatic = "navigation"` so unknown ids render fully and `notFound()`
  returns a real 404 (otherwise Partial Prefetching serves the fallback shell with a 200). Read
  `node_modules/next/dist/docs/` before using unfamiliar APIs.
- **Keep the repo out of iCloud-synced folders** (Desktop/Documents). macOS can evict `node_modules` files, and
  every tool hangs.
- Remotion requires a company license for teams of 4+ people. See https://remotion.dev/license.
