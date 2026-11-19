# algovizlib

Short animated videos that explain computer science concepts (starting with data structures, algorithms, and
system design) through real-world examples. Each video focuses on the **approach**, not a line-by-line code
walkthrough.

The library is organized by **category → pattern → problem**. Data Structures & Algorithms has 20 patterns in four
groups, with 103 problems across easy, medium, and hard:

| Group          | Patterns                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Foundations    | Arrays & Hashing, Prefix Sum, Sorting Algorithms, Bit Manipulation                                       |
| Core patterns  | Two Pointers, Fast & Slow Pointers, Sliding Window, Binary Search, Stack, Linked List, Intervals, Greedy |
| Trees & Graphs | Trees (DFS), Graphs (BFS), Heap / Priority Queue, Trie, Advanced Graphs                                  |
| Advanced       | Backtracking, Dynamic Programming, Data Structure Design                                                 |

Most patterns have 5 problems; Sorting Algorithms has one per algorithm (bubble, selection, insertion, merge, quick,
heap, counting) plus Count Inversions. Problems that teach more than one pattern are cross-listed with an "also in"
label. Every problem has an original statement, examples (design problems show an operation → output table),
progressive hints, and the approach behind a spoiler toggle, and every example is checked against a reference
solution. Problems with a video play it inline: five Two Pointers problems and all eight Sorting problems (merge,
quick, and heap sort get split, partition, and heap-tree views; Count Inversions gets a running counter). The first is
**Pair with Target Sum**, told as a price-sorted shelf where you and a friend spend a $50 gift card exactly. System Design is coming soon.

You can mark each problem Not started / Learning / Done. Progress is saved in your browser.

Videos are **trace-bound storyboards**: deterministic code runs each algorithm on one example and records every
decision, and a storyboard's pointers, equations, and highlights come from (and are checked against) that trace.
Storyboards can be generated offline by a model: the model writes the story, the validator guarantees the moves.

## Stack

Next.js (App Router, `src/`) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Remotion (`@remotion/player`) ·
Zustand · Zod · Vitest · ESLint + Prettier · pnpm

## Getting started

Requirements: Node.js 20+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Routes:

| Route                   | Page                                                 |
| ----------------------- | ---------------------------------------------------- |
| `/`                     | Landing                                              |
| `/dsa`                  | Patterns grouped in four sections, with progress     |
| `/dsa/<pattern>`        | Pattern intro and a filterable problem table         |
| `/dsa/<pattern>/<slug>` | Problem: statement, examples, video, hints, approach |
| `/system-design`        | Coming soon, with planned topics                     |

Press **Cmd/Ctrl + K** anywhere to jump to a pattern group, pattern, or problem. Old `/learn/two-pointers` links redirect permanently
to `/dsa/two-pointers/pair-with-target-sum`.

## Scripts

| Command           | What it does                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`        | Start the dev server                                                                             |
| `pnpm build`      | Production build                                                                                 |
| `pnpm start`      | Serve the production build                                                                       |
| `pnpm lint`       | ESLint                                                                                           |
| `pnpm typecheck`  | Generate route types and run `tsc`                                                               |
| `pnpm test`       | Run the Vitest suite once (includes checking every problem example against a reference solution) |
| `pnpm test:watch` | Vitest in watch mode                                                                             |
| `pnpm format`     | Format with Prettier                                                                             |

## Generating storyboards

Requires a model key in `.env.local` (copy `.env.example`). The default provider is Google Gemini
(`gemini-3.8-flash`, available on the free tier); set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` to use Claude.

```bash
pnpm generate:storyboards --pattern two-pointers --dry-run   # validate and print; nothing written
pnpm generate:storyboards --pattern two-pointers             # write src/content/storyboards/generated/…
pnpm generate:storyboards --missing                          # everything generatable that has no video yet
```

No model available? Claude Code (or you) can write the draft by hand against the same prompt and checks:
`pnpm storyboards:prompt <pattern>/<slug>` prints the instructions, and `pnpm storyboards:validate-draft <path...>`
validates (`--dry-run`) and saves it like a generated storyboard.

Flags: `--problem <pattern>/<slug>`, `--force`, `--max-requests <n>` (default 15). Valid results are cached in
`.cache/generation`, so a real run after a dry run makes no new requests. On the free tier's daily limit the run stops
cleanly and tells you to rerun with `--missing` the next day. Details: [CLAUDE.md](./CLAUDE.md).

## Player controls

Play/pause, scrubber, speed (0.5x–2x), and fullscreen. Keyboard: **Space** play/pause, **←/→** seek 5 seconds,
**Shift + ←/→** previous/next scene, **F** fullscreen. Click a scene in the list (or in the transcript) to jump to it.

## Deploying

Import the repo into Vercel. It needs no configuration: the framework, pnpm, and the build command are detected
automatically, and every page is statically prerendered.

## Contributing

See [CLAUDE.md](./CLAUDE.md) for the architecture, the content model, how to add a pattern or a problem, how to
attach a video, the storyboard and primitive system, the rules for choosing an example, the practice-mode plan, and
the roadmap.

## License notes

Remotion is free for individuals and small teams. Companies of 4+ people need a
[Remotion company license](https://remotion.dev/license).
