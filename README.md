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
solution. Problems with a video play it inline: five Two Pointers problems, all eight Sorting problems (merge,
quick, and heap sort get split, partition, and heap-tree views; Count Inversions gets a running counter), and all five
Sliding Window problems (a window bracket that grows and shrinks, character counts, and a monotonic deque), and all five
Binary Search problems (a shrinking search range with the dropped half dimmed, a number line of candidate answers, and
partition cuts across two lists), and all five Linked List problems (nodes and arrows that visibly rewire one link at a
time, a dummy node, several lists merging into one, and Merge K's min-heap of heads), and all five Trees (DFS)
problems (the tree with the running call, the open path from the root, finished calls and what they returned, values
traveling up the edges, and the call stack beside it), and all five Graphs (BFS) problems (a grid or graph with the
frontier spreading one level at a time, neighbor checks with the reason each is skipped, and a queue that marks where
each level begins), and all five Heap / Priority Queue problems (a tree and its backing array moving together as
items sift up and down, size-k heaps, and two heaps keeping a running median), and all five Dynamic Programming problems (a table filling cell by cell
with arrows from the cells it reads, a staircase and a street lined up with their tables, and the recursion tree a
table replaces), and all five Stack problems (a stack column beside the input, monotonic stacks whose pops link each
item to its answer, and the rectangle each popped bar resolves), and all five Backtracking problems (a decision tree
that grows choice by choice, with dead ends folded away, pruned branches and their reasons, and the answer being built
and undone; N-Queens on its board), and all five Arrays & Hashing problems (a hash map answering each lookup in one
step, grouped buckets, a set of runs, and a cyclic sort). The first is
**Pair with Target Sum**, told as a price-sorted shelf where you and a friend spend a $50 gift card exactly. System Design is coming soon.

Each problem has a status: Not started / Learning / Done. Playing its video, opening a hint, or showing the approach
marks it Learning; finishing the video asks "Mark as done?" (Done is never set for you, and your own choice always
wins). Videos remember where you stopped and offer "Resume from 0:42". Without an account all of this is saved in
your browser. **Signing in is optional** (GitHub or Google; email + password behind a flag, see Accounts): then
progress and video positions sync across devices, and `/me` shows progress by group and pattern, what to continue,
and what you finished recently.

Videos are **trace-bound storyboards**: deterministic code runs each algorithm on one example and records every
decision, and a storyboard's pointers, equations, and highlights come from (and are checked against) that trace.
Storyboards can be generated offline by a model: the model writes the story, the validator guarantees the moves.

## Stack

Next.js (App Router, `src/`) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Remotion (`@remotion/player`) ·
Zustand · Zod · Auth.js v5 · Prisma + Postgres (Neon) · Argon2id · Resend · Vitest · ESLint + Prettier · pnpm

## Getting started

Requirements: Node.js 20+, pnpm (`corepack enable pnpm`), and Postgres for accounts (locally:
`brew install postgresql@16 && brew services start postgresql@16`).

```bash
pnpm install                       # also generates the Prisma client
cp .env.example .env.local         # then fill in DATABASE_URL and AUTH_SECRET (below)
createdb algovizlib_dev && createdb algovizlib_test
pnpm db:migrate                    # apply the migrations to DATABASE_URL
pnpm dev
```

Minimal `.env.local` for accounts (never commit it): `DATABASE_URL=postgresql://<you>@localhost:5432/algovizlib_dev`,
`DATABASE_URL_TEST=postgresql://<you>@localhost:5432/algovizlib_test`, and `AUTH_SECRET` from `npx auth secret`.
Email + password sign-in is on locally, and verification and reset links are printed to the dev server's console
(no email service needed). GitHub and Google buttons appear once their `AUTH_*_ID`/`_SECRET` are set. Everything
else works without any of this: guests never touch the database.

Open http://localhost:3000. Routes:

| Route                                                               | Page                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| `/`                                                                 | Landing                                              |
| `/dsa`                                                              | Patterns grouped in four sections, with progress     |
| `/dsa/<pattern>`                                                    | Pattern intro and a filterable problem table         |
| `/dsa/<pattern>/<slug>`                                             | Problem: statement, examples, video, hints, approach |
| `/system-design`                                                    | Coming soon, with planned topics                     |
| `/me`                                                               | My progress: by group and pattern, continue, done    |
| `/login`, `/account`                                                | Sign in (optional); linked providers, password       |
| `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Email + password (when enabled)                      |

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
| `pnpm db:migrate` | Create/apply Prisma migrations on `DATABASE_URL` (development)                                   |
| `pnpm db:deploy`  | Apply committed migrations (production: run against Neon's direct URL)                           |
| `pnpm db:studio`  | Browse the database                                                                              |

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

Videos are narrated. Videos voiced with [ElevenLabs](https://elevenlabs.io) play one continuous recorded track and
take their scene timing from it; the rest are read by the browser's built-in voice (Web Speech API), which never cuts
a sentence at a scene change: the video waits for it instead. Without either, the video plays silently with captions and the transcript. A label under the player says
which voice is active ("Narrated by ElevenLabs" / "Browser voice"), and the footer credits ElevenLabs, as its free
plan requires.

Narration is made offline. Each scene is voiced once with ElevenLabs (clips kept under `narration/clips/`, not
served), then each video's clips are stitched into **one continuous track** (`public/audio/<video>/narration-*.mp3`)
with even pauses between scenes. The player plays that single track, so scene changes never interrupt the voice, and
scene timing comes from where each scene's speech starts in it. Everything is listed in
`src/content/narration/manifest.json`. Set `ELEVENLABS_API_KEY` in `.env.local` (see `.env.example`) and install
ffmpeg (`brew install ffmpeg`, used only for stitching), then:

```bash
pnpm generate:narration --storyboard sorting/merge-sort --storyboard sorting/heap-sort --dry-run   # characters, no calls
pnpm generate:narration --storyboard sorting/merge-sort --storyboard sorting/heap-sort             # voice + stitch
pnpm generate:narration --missing                                                                  # everything not voiced yet
pnpm generate:narration --stitch-only                                                              # restitch, no requests
```

The free plan covers about 20,000 characters a month on the Flash model; a video's narration is ~900–1,950. Each run
stops before a video that would pass `--max-chars` (default 9,000), never re-pays for unchanged narration (clips are
named by a hash of the text, voice, and model), and stops cleanly, keeping what's saved, when the monthly quota runs
out. Details: [CLAUDE.md](./CLAUDE.md).

## Player controls

Play/pause, scrubber, speed (0.5x–2x, narration keeps its pitch), narration mute and volume (remembered), and
fullscreen. Keyboard: **Space** play/pause, **←/→** seek 5 seconds, **Shift + ←/→** previous/next scene, **M** mute,
**F** fullscreen. Click a scene in the list (or in the transcript) to jump to it. Sound starts only when you press
play.

## Accounts

Auth.js v5 (pinned to `5.0.0-beta.32`) with GitHub, Google, and email + password; sessions are httpOnly JWT cookies,
and changing or resetting a password signs out every other session. Data lives in Postgres through Prisma
(`prisma/schema.prisma`, migrations committed): Auth.js's tables, `AuthToken` (hashed single-use verification and
reset tokens), `RateLimit` (shared counters for login, register, and reset limits), and `Progress` (per user and
problem: status, whether you set it yourself, and the last video position). Passwords are hashed with Argon2id.

Email + password is behind `AUTH_EMAIL_PASSWORD_ENABLED` (on locally, off in production): it needs a sending domain
verified with Resend, because Resend's free plan without one only delivers to your own address. To turn it on in
production: verify a domain in Resend, set `RESEND_API_KEY`, `EMAIL_FROM` (an address on that domain), and
`AUTH_EMAIL_PASSWORD_ENABLED=true` in Vercel, and redeploy. Full setup, data model, and rules: [CLAUDE.md](./CLAUDE.md).

## Deploying

Import the repo into Vercel: the framework, pnpm, and the build command are detected automatically, and every page
is statically prerendered (session and progress load in the browser). Accounts need these environment variables in
Vercel (Production): `DATABASE_URL` (Neon, pooled), `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, plus `DATABASE_URL_UNPOOLED` for running `pnpm db:deploy` (migrations are
never run by the build). See `.env.example`.

## Contributing

See [CLAUDE.md](./CLAUDE.md) for the architecture, the content model, how to add a pattern or a problem, how to
attach a video, the storyboard and primitive system, the rules for choosing an example, the practice-mode plan, and
the roadmap.

## License notes

Remotion is free for individuals and small teams. Companies of 4+ people need a
[Remotion company license](https://remotion.dev/license).

Narration clips come from the ElevenLabs free plan, which requires crediting ElevenLabs (the footer and player do)
and doesn't include a commercial license. Fine for a portfolio; a commercial site needs a paid plan.
