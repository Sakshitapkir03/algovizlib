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

Offline tooling: `pnpm generate:storyboards` (below) and `pnpm generate:narration` (voice-over, below).

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

## Narration

Videos are narrated. Scenes voiced with [ElevenLabs](https://elevenlabs.io) play their recorded clip and take their
length from it; the rest are read by the browser's built-in voice (Web Speech API), which waits at a scene's end if it
runs long. Without either, the video plays silently with captions and the transcript. A label under the player says
which voice is active ("Narrated by ElevenLabs" / "Browser voice"), and the footer credits ElevenLabs, as its free
plan requires.

Clips are made offline and committed as small MP3s under `public/audio/`, listed in
`src/content/narration/manifest.json`. Set `ELEVENLABS_API_KEY` in `.env.local` (see `.env.example`), then:

```bash
pnpm generate:narration --storyboard sorting/merge-sort --storyboard sorting/heap-sort --dry-run   # characters, no calls
pnpm generate:narration --storyboard sorting/merge-sort --storyboard sorting/heap-sort             # voice them
pnpm generate:narration --missing                                                                  # everything not voiced yet
```

The free plan covers about 20,000 characters a month on the Flash model; a video's narration is ~1,500–1,950. Each run
stops before a video that would pass `--max-chars` (default 9,000), never re-pays for unchanged narration (clips are
named by a hash of the text, voice, and model), and stops cleanly, keeping what's saved, when the monthly quota runs
out. Details: [CLAUDE.md](./CLAUDE.md).

## Player controls

Play/pause, scrubber, speed (0.5x–2x, narration keeps its pitch), narration mute and volume (remembered), and
fullscreen. Keyboard: **Space** play/pause, **←/→** seek 5 seconds, **Shift + ←/→** previous/next scene, **M** mute,
**F** fullscreen. Click a scene in the list (or in the transcript) to jump to it. Sound starts only when you press
play.

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

Narration clips come from the ElevenLabs free plan, which requires crediting ElevenLabs (the footer and player do)
and doesn't include a commercial license. Fine for a portfolio; a commercial site needs a paid plan.
