# algovizlib

Short animated videos that explain computer science concepts (starting with data structures, algorithms, and
system design) through real-world examples. Each video focuses on the **approach**, not a line-by-line code
walkthrough.

The library is organized by **category → pattern → problem**. Data Structures & Algorithms has 8 patterns (Two
Pointers, Sliding Window, Binary Search, Stack, Linked List, Trees (DFS), Graphs (BFS), Dynamic Programming), each
with 5 problems across easy, medium, and hard. Every problem has an original statement, examples, progressive hints,
and the approach behind a spoiler toggle. Problems with a video play it inline; the first is **Pair with Target
Sum**, told as a price-sorted shelf where you and a friend spend a $50 gift card exactly. System Design is coming soon.

You can mark each problem Not started / Learning / Done. Progress is saved in your browser.

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
| `/dsa`                  | Pattern grid with per-pattern progress               |
| `/dsa/<pattern>`        | Pattern intro and a filterable problem table         |
| `/dsa/<pattern>/<slug>` | Problem: statement, examples, video, hints, approach |
| `/system-design`        | Coming soon, with planned topics                     |

Press **Cmd/Ctrl + K** anywhere to jump to a pattern or problem. Old `/learn/two-pointers` links redirect permanently
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
