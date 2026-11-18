# algovizlib

Short animated videos that explain computer science concepts (starting with data structures, algorithms, and
system design) through real-world examples. Each video focuses on the **approach**, not a line-by-line code
walkthrough.

The first video is **Two Pointers** (pair sum on a sorted array), told as a price-sorted shelf where you and a
friend look for two items that use up a $50 gift card exactly.

## Stack

Next.js (App Router, `src/`) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Remotion (`@remotion/player`) ·
Zustand · Zod · Vitest · ESLint + Prettier · pnpm

## Getting started

Requirements: Node.js 20+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000, then pick **Two Pointers** to open `/learn/two-pointers`.

## Scripts

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Start the dev server               |
| `pnpm build`      | Production build                   |
| `pnpm start`      | Serve the production build         |
| `pnpm lint`       | ESLint                             |
| `pnpm typecheck`  | Generate route types and run `tsc` |
| `pnpm test`       | Run the Vitest suite once          |
| `pnpm test:watch` | Vitest in watch mode               |
| `pnpm format`     | Format with Prettier               |

## Player controls

Play/pause, scrubber, speed (0.5x–2x), and fullscreen. Keyboard: **Space** play/pause, **←/→** seek 5 seconds,
**Shift + ←/→** previous/next scene, **F** fullscreen. Click a scene in the list (or in the transcript) to jump to it.

## Deploying

Import the repo into Vercel. It needs no configuration: the framework, pnpm, and the build command are detected
automatically, and every page is statically prerendered.

## Contributing

See [CLAUDE.md](./CLAUDE.md) for the architecture, the storyboard and primitive system, how to add a primitive
or a problem, the rules for choosing an example, and the roadmap.

## License notes

Remotion is free for individuals and small teams. Companies of 4+ people need a
[Remotion company license](https://remotion.dev/license).
