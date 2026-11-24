@AGENTS.md

# algovizlib

A web app that teaches computer science concepts (DSA first, then system design) through a curated **catalog**
(category → pattern → problem) and short animated videos. Each video explains the **approach** through a concrete
real-world example, not a line-by-line code walkthrough. Narration is voiced offline with ElevenLabs (stitched into one continuous
track per video) where the budget allows and read by the browser's own voice everywhere else (see "Narration").
Signing in (GitHub, Google, or email + password behind a flag) is optional and syncs progress and video positions
across devices; guests keep everything in the browser (see "Progress" and "Accounts").

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
pnpm generate:narration --storyboard two-pointers --dry-run   # offline ElevenLabs voice-over (see "Narration")
pnpm db:migrate   # Prisma: create/apply migrations on DATABASE_URL (dev); pnpm db:deploy applies them (production)
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
    login, register, forgot-password, reset-password, verify-email/   auth pages (static shells, client forms)
    privacy/, terms/         privacy policy and terms of use (keep accurate; see "Accounts")
    account/, me/            account settings; My progress (both read the session/progress in the browser)
    api/auth/[...nextauth]/  Auth.js;  api/progress (GET, POST one change, sendBeacon) + api/progress/merge
    api/ask/                 the tutor: GET a step's label + suggestions, POST a question (streamed answer)
    api/checks/              quick check answers: GET the latest, POST a batch (see "Quick checks")
  components/
    ui/                      shadcn/ui (radix-nova). Slider has thumbLabel/thumbValueText for a11y
    catalog/                 difficulty badge, path breadcrumb, problem table, hints, approach toggle, progress UI
    learn/                   LearnView, VideoStage (client-only Player), controls, scene list, transcript, takeaway,
                             ask-panel ("Ask about this step"), video-section (original video / "Your input" switch),
                             try-input-panel (the editor and walkthrough player; lazy), quick-check card +
                             use-quick-checks (pause, answer, record)
    site/                    header, Cmd/Ctrl+K command palette, theme toggle/provider
    account/                 AccountProvider (session + progress sync), user menu, verify banner, auth forms, /me
  content/
    catalog/                 categories, patterns/<slug>.ts, problems/<pattern>/<slug>.ts, index.ts
    storyboards/             hand-written storyboards + registry (index.ts)
      generated/             <pattern>/<slug>.json written by the generator + index.ts (regenerated, don't edit)
    narration/manifest.json  per storyboard: clips (per scene) + the stitched track and scene offsets, by the script
    legacy-redirects.ts      old /learn/<id> URLs (imported by next.config.ts)
  lib/
    catalog/                 Zod schemas, define*(), judgeOutput(), repository.ts (the only way pages read content)
    progress/                records + rules (merge, auto-status), browser/account repositories, the tab's hub
                             (useProgress), resume math, video tracker, server store + API logic
    auth/                    flags, validation, password (Argon2id), tokens, rate limits, store, mailer, service
                             (the email + password flows), linking rules, deps, server actions
    db.ts                    Prisma client (Neon in production, local Postgres in development)
    storyboard/              Zod schemas (source + resolved), defineStoryboard(), resolveStoryboard(),
                             validateStoryboard(), primitive catalog, timing/timeline helpers
    traces/                  deterministic instrumented solutions: <pattern>/<slug>.ts + registry (app code)
    narration/               app side of narration: hash, manifest + withNarration(), NarrationEngine (sync),
                             browser speech/audio adapters
    walkthrough/             "Try your own input": field types, per-problem specs, the supported list, the shared
                             trace → scenes builder (also the test fixture's), build, the browser runner + share links
    quickcheck/              quick checks: schema, builder, validator, schedule (pause frames, keys), results
                             (browser recorder), server (API logic, Prisma store), for-problem (page, server-only)
    tutor/                   "Ask about this step": config + flag, step context, suggestions, prompt, usage counts +
                             answer cache, model (the app's one AI SDK use, server-only), service, deps
    generation/              OFFLINE ONLY: model adapter, prompts/, pipeline, cache, writer, CLI (never in the app)
      narration/             OFFLINE ONLY: ElevenLabs client, stitching (+ ffmpeg), MP3 duration, pipeline, CLI, store
  video/                     Remotion composition, scene renderer, primitives + registry, theme
    fit/                     the phone-width fit checks (scene.ts: `sceneFitProblems`), shared by tests and the browser
  auth.ts                    Auth.js config (providers, JWT callbacks, linking check)
  generated/prisma/          Prisma client (generated on install; gitignored)
  store/player-store.ts      Zustand: mirrors PlayerRef events, exposes toggle/seekTo, volume/mute (remembered), hold
  hooks/                     useReducedMotion
scripts/generate-storyboards.ts   the generator CLI (tsx)
scripts/generate-narration.ts     the narration CLI (tsx)
prisma/schema.prisma, prisma/migrations/   the data model and committed migrations (prisma.config.ts reads .env.local)
public/audio/<storyboard>/        the stitched narration track, narration-<hash>.mp3 (served)
narration/clips/<storyboard>/      per-scene ElevenLabs clips, <scene>-<hash>.mp3 (stitching source, not served)
tests/                       Vitest specs (fixtures/drafts.ts builds a correct draft from any trace, through
                             `traceScenes()` in lib/walkthrough/scenes.ts)
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
- **Text stays readable at any player size.** `VideoStage` measures the player and passes `displayWidth`; the
  composition builds `textMetrics(displayWidth)` (`video/text.ts`) and every primitive sets font sizes with
  `text.size(TEXT.<role>)`, which never renders below 11px on screen (on a 343px phone player that's ~42px in the
  1280px composition). `layoutScene()` reserves room from the same sizes, stacking from the bottom stack up (brackets,
  pointers, panels) and raising the bottom stack when its contents need it; when a short bottom stack would squeeze
  an item-row's cards, it moves down instead. Pointers under a row that share a position stack (`pointerLevel`), and
  item labels are dropped when a card is too short for them. Labels that don't fit are abbreviated or
  dropped (`video/labels.ts`: pointer labels fall back to the bound trace name, then a letter; "✓ sorted" to "✓";
  "◆ pivot" to "◆"). On a phone-sized player (`text.compact`) secondary text is hidden: callouts, highlight tag words
  (border style carries the state: solid active, dashed rejected, double found), position/role labels in the heap
  tree, "▲" markers, the chrome's title. The fit checks are app code, `sceneFitProblems()` in `src/video/fit/scene.ts`
  (with one module per primitive family beside it), so "Try your own input" refuses a walkthrough the same way.
  `tests/video-text.test.ts` forbids literal `fontSize` values in `src/video`
  and checks every scene of every video at phone width (values fit their bars, cells, and nodes; pointers don't
  overlap; nothing runs into the bottom stack).

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
  externalRefs: { label, url, premium? }[],   // premium: LeetCode Premium-only, shown with a "Premium" label
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

Per problem (key `"<pattern>/<slug>"`): a status (`not-started | learning | done`), whether the learner chose it
(`manual`), when it changed, and the last video position (`{ sceneId, seconds, updatedAt }`). Types and rules are
in `lib/progress/records.ts` (pure, shared by browser, server, and tests):

- **Changes** are `ProgressChange` ops: `set-status` (manual), `mark-learning`, `save-position`, `clear-position`,
  applied by `applyChange()` everywhere, so the browser copy, the account copy, and the server follow one set of rules.
- **Automatic status:** playing a problem's video, revealing a hint, or opening "Show approach" applies
  `mark-learning`, which only changes a status that is "Not started" and wasn't chosen by the learner (a manual "Not
  started" stays). "Done" is never set automatically: a finished video shows a non-blocking "Mark as done?". The
  selector always wins. A one-time note by the selector explains this (`algovizlib:status-note-seen`).
- **Merge** (guest → account, `mergeRecords`): the more advanced status wins (never a downgrade), the newer position
  wins. The server clamps future timestamps and drops unknown problems.

Where it lives (`ProgressRepository`: `getSnapshot` (statuses), `getRecords`, `set`, `apply`, `subscribe`,
`persistent`, `kind`):

- **Browser copy** (`createLocalProgressRepository`): guests, and signed-in users whose email isn't verified.
  localStorage `algovizlib:progress:v2` (version 1 statuses are migrated once), synced across tabs, memory fallback.
- **Account copy** (`createAccountProgressRepository`): verified users. Applies changes at once and POSTs each to
  `/api/progress`; on page hide, `sendBeacon`. A failed write reloads from the server.
- **The hub** (`lib/progress/use-progress.ts`): one active copy per tab. `AccountProvider` (root layout) watches the
  session and calls `syncAccountProgress`: for a verified user it POSTs the browser copy to `/api/progress/merge`,
  clears it, and switches to the account copy; signing out switches back to the (now empty) browser copy. Components
  only use `useProgress()` / `useProgressRecords()` / `applyProgress()`.

**Video resume** (`lib/progress/resume.ts`, `video-tracker.ts`, used by `LearnView` when given `problemKey`): the
position is saved every 5 s while playing, on pause, on a scene change, and on page hide (beacon); not in the first
3 s or the last 2 s; reaching the end clears it. On open, "Resume from 0:42" / "Start over" seek the player (the
narration engine resyncs on seeks). If the video's timing changed, it resumes at the saved scene's start; if the
scene is gone, nothing is offered. Links ending in `#resume` (from `/me` and the landing "Continue" card) resume
automatically.

## Accounts

Signing in is optional; guests can use everything. Auth.js v5 (**pinned to `5.0.0-beta.32`**, with
`@auth/prisma-adapter`), configured in `src/auth.ts`:

- **Providers:** GitHub and Google, each registered only when its `AUTH_*_ID`/`_SECRET` are set; email + password
  (Credentials) only when `AUTH_EMAIL_PASSWORD_ENABLED` is on (`lib/auth/flags.ts`: on by default locally, off by
  default in production). When it's off, the credentials provider isn't registered, the form is hidden, the
  register/forgot/reset/verify pages 404, and every email + password action refuses (`MESSAGES.disabled`).
- **Sessions:** JWT in httpOnly, SameSite=Lax cookies (Secure on https); required by the credentials provider. The
  `jwt` callback re-reads the user on every read, so `emailVerified`, name, and linked providers stay current, and a
  session whose `sv` differs from the user's `sessionVersion` is signed out. Changing or resetting a password bumps
  it (change-password signs out this session too and sends you to `/login?notice=password-changed`).
- **Pages stay static.** Session and progress are read in the browser (`SessionProvider` → `/api/auth/session`), the
  header's user menu and the `/me`, `/account`, and landing "Continue" islands are client components. Only
  `/api/*` is dynamic.
- **Flows** (`lib/auth/service.ts`, dependencies injected, wrapped by server actions in `lib/auth/actions.ts`):
  register (a taken email gets the same answer and an "already have an account" email; the same Argon2 work runs),
  verify (the email link opens `/verify-email`, the token is used only by pressing the button, a POST, so link
  scanners can't use it up), forgot/reset (same answer for unknown emails; reset uses the token, deletes other reset
  links, bumps `sessionVersion`, and marks the email verified), resend verification, change password. Login answers
  "Invalid email or password." for an unknown email, a wrong password, or an account without one, and checks a
  dummy hash when there's nothing to check (`verifyAgainstDummy`), so timing doesn't tell either.
- **Passwords:** Argon2id (`@node-rs/argon2`, 19 MiB, t=2, p=1; PHC strings), 10–128 characters, a strength hint
  (`lib/auth/strength.ts`, no dictionary download). Never stored, logged, or encrypted reversibly.
- **Tokens:** 32 random bytes (base64url) in the link; only the SHA-256 hash is stored (`AuthToken`); consumed with
  one `DELETE … RETURNING`, so it works once even under concurrent requests. Verify: 24 hours; reset: 30 minutes.
- **Unverified email + password accounts** can sign in, but progress stays in the browser (the API answers 403) and a
  banner offers to resend the link; verifying merges it into the account.
- **Account linking** (`lib/auth/linking.ts`, checked in the `signIn` callback; providers set
  `allowDangerousEmailAccountLinking` so Auth.js links by email only after this check passes): an already linked
  provider account signs in; a valid session linking from `/account` is allowed (a session that was signed out is
  refused); otherwise the provider must say the email is verified (Google `email_verified`; GitHub `/user/emails`'
  `verified`), and an existing account with that email is linked only if its email is verified too. Refusals go to
  `/login?error=account-exists | unverified-provider-email | session-expired` with a clear message. The adapter is
  wrapped (`lib/auth/adapter.ts`): emails are lowercased, and a linked `Account` keeps only provider, account id,
  and type, never the provider's access/refresh/ID tokens (nothing calls GitHub or Google after sign-in).
- **Privacy and terms** (`/privacy`, `/terms`, linked from the footer and the sign-in page; layout in
  `components/site/legal-page.tsx`) describe exactly what the code does: what's stored, cookies, rate-limit counts,
  providers (Vercel, Neon, GitHub/Google), pre-generated narration, deletion by email. **Any change to sign-in,
  stored data, providers, or narration must update them and their effective date in the same commit** (e.g.
  turning on email + password: mention hashed passwords and Resend). Google's OAuth branding uses
  `/privacy` and `/terms`.
- **Rate limits** (`lib/auth/rate-limit.ts`, fixed windows in the `RateLimit` table, shared by every instance): login
  30/15 min per IP and 10/15 min per email; register 5/h per IP and 3/h per email; forgot 10/15 min per IP and 3/h
  per email; reset and verify per IP; resend and change-password per user; progress writes 300/min per user; quick
  check answers 120 requests/min per user.
  Locally every request has the IP "local", so repeated test sign-ins can hit the IP limit: `DELETE FROM "RateLimit"`.
- **CSRF:** Auth.js protects its routes; server actions get Next's Origin check; `/api/progress` POSTs require a
  same-origin `Origin` header (`sameOrigin`), on top of SameSite cookies.
- **Email** (`lib/auth/mailer.ts`): Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set; otherwise the message and
  link are printed to the server console (development). Production refuses to run email + password without Resend
  (links must never land in production logs). Links use `APP_URL` (else Vercel's production domain), never the
  request's Host header.
- **Never on the client:** `@/auth`, `@/lib/db`, the auth store/service/password/tokens/mailer/deps, the progress
  server code, and the tutor's model, service, usage, and deps; the modules holding secrets import `server-only`, and `tests/auth-boundaries.test.ts` checks every
  client component's imports. Client components call server actions only.

**Data model** (`prisma/schema.prisma`): `User` (+ `passwordHash`, `sessionVersion`), `Account`, `Session` and
`VerificationToken` (the adapter's shape; unused with JWT sessions and no magic links), `AuthToken` (purpose,
`tokenHash`, `expiresAt`), `RateLimit` (`key`, `windowStart`, `count`), `Progress` (`userId` + `problemKey`, `status`,
`statusManual`, `statusUpdatedAt`, `sceneId`, `positionSeconds`, `positionUpdatedAt`), `CheckResult` (`userId` + an `id`
made in the browser, `problemKey`, `questionId`, `sceneId`, `step`, `correct`, `source` video | walkthrough, `input`,
`answeredAt`), `AskCache` (`key`, a hash of
the tutor's prompt version, model, problem, scene, and suggested question; `answer`; `createdAt`: no user). Deleting a
user cascades.

**Setup.** Locally: Postgres (`brew services start postgresql@16`), `createdb algovizlib_dev algovizlib_test`, then in
`.env.local`: `DATABASE_URL`, `DATABASE_URL_TEST`, `AUTH_SECRET` (`npx auth secret`), and for `pnpm start`
`AUTH_TRUST_HOST=true`; `pnpm db:migrate`. One GitHub OAuth app and one Google OAuth client serve both
environments: each lists both callbacks, `https://algovizlib.vercel.app/api/auth/callback/<github|google>` and
`http://localhost:3000/api/auth/callback/<github|google>` (put the same ids/secrets in `.env.local` to use them
locally). Production (Vercel, Production environment): `DATABASE_URL`
(Neon pooled), `DATABASE_URL_UNPOOLED` (Neon direct, for migrations), `AUTH_SECRET` (a new one, not the local one),
`AUTH_GITHUB_ID`/`_SECRET`,
`AUTH_GOOGLE_ID`/`_SECRET`; apply migrations with `pnpm db:deploy` against the direct URL before deploying a schema
change (the build never migrates, so previews can't touch production data).

**Turning on email + password in production:** add and verify a domain you own in Resend (DNS records), then set
`RESEND_API_KEY`, `EMAIL_FROM` (`"algovizlib <hello@that-domain>"`), `AUTH_EMAIL_PASSWORD_ENABLED=true`, and
`APP_URL` in Vercel and redeploy (the flag is read at build time for the pages and at run time for the actions).
Without a verified domain, Resend's free plan only delivers to the account owner's own address.

Tests: `tests/auth.test.ts` (Argon2id, validation, generic login errors, rate limits, tokens single-use and expiry,
reset/change rules, duplicate registration, the flag, email), `tests/auth-linking.test.ts`,
`tests/auth-boundaries.test.ts`, `tests/progress.test.ts` (browser copy, v1 migration),
`tests/progress-sync.test.ts` (auto-status, merge, the hub's guest → account switch, API access control, resume and
the video tracker with a fake player), `tests/db.integration.test.ts` (Prisma stores, concurrent token use, shared
rate limits, per-user isolation; runs against `DATABASE_URL_TEST`, skipped without it). No test calls a real OAuth
provider or sends email; only `DATABASE_URL_TEST` is read from `.env.local` (`vitest.config.ts`).

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
  `terms`/`operator`/`result`/`comparison`/`verdictTone`, highlight `indices`, bar `fill`/`water`, the sorting and divide-and-conquer
  primitives' state (see Primitives), and a `result`'s `value` when `showsAnswer: true`. Any value that _is_ written is kept and checked against the trace.
- **Resolved** (`storyboardSchema`, `Storyboard`): every value present. `resolveStoryboard()` produces it;
  renderers and the validator only see this form.

- `narration` is what gets voiced. `caption` is the short on-screen headline.
- `durationInFrames` is `estimateDurationInFrames(narration)` (~150 wpm plus padding, 30 fps) in storyboard files.
  For a voiced scene, `withNarration()` replaces it with `narrationDurationInFrames(clip)` (lead-in + measured clip +
  0.7 s pause) and sets `scene.audio`. Element timing is relative (below), so animations stay in sync either way.
- Schema-level checks (in `superRefine`): unique scene/element ids, and every `rowId`/index reference points at an
  existing item-row or bar-row and an in-range item.

## Primitives

`Element` is a Zod discriminated union on `type`. Every element has `id` and `enterAt` (0–1, a **fraction** of the
scene's duration, so timing survives the switch to audio-driven lengths).

| type            | purpose                                                                                                                                                                                 | slot   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `item-row`      | labeled cards with values (product + price, `a[i]` + value, a character)                                                                                                                | canvas |
| `bar-row`       | vertical bars on a baseline; optional container `fill`, per-bar `water`, `moves` (bars slide; a swap arcs), `empty` (dashed slots), `maxValue` (one scale per video)                    | canvas |
| `pointer`       | named marker on an item; `fromIndex` makes it slide; `binds` ties it to a trace pointer                                                                                                 | canvas |
| `highlight`     | emphasize items: `active` / `rejected` / `found` (glyph + word + border style, never color alone)                                                                                       | canvas |
| `callout`       | speech bubble; anchored to an item or floating at the top                                                                                                                               | canvas |
| `equation`      | `terms` joined by `operator` (+, −, ×), `result`, optional `comparison`, `verdict` + `verdictTone`                                                                                      | bottom |
| `result`        | final answer / stat card; `showsAnswer` / `indices` checked against the trace                                                                                                           | bottom |
| `sorted-region` | positions in final order (`indices`: a range or a scattered set): a shaded band per run + baseline segment, "✓ sorted" beside the row                                                   | canvas |
| `held-value`    | a value lifted out of the row (insertion sort's key) in a strip above its gap                                                                                                           | canvas |
| `count-array`   | tally panel under the bars, one cell per key; the changed cell gets a thick border and ▲                                                                                                | canvas |
| `segments`      | brackets under the bars for the current split (groups drawn apart); the active group gets a thick bracket, a faint band, and "▶ level d"                                                | canvas |
| `split-tree`    | static overview of every split level at once (whole array → single values), each group a small box of its values                                                                        | bottom |
| `merge-buffer`  | merge output so far, one slot per position under the range being merged; the slot just written gets a thick border and "▲ new"                                                          | canvas |
| `partition`     | quick sort: "◆ pivot" tag above the pivot bar, dashed boundary with "◀ smaller", bars outside the range dimmed                                                                          | canvas |
| `heap-tree`     | the same array as a binary tree (children 2i+1, 2i+2) on the right; compared parent/child ringed and labeled, nodes past the heap dashed with ✓, moves match the bars                   | canvas |
| `counter`       | a labeled running total with this step's "+N" (inversions here; reusable for swaps, comparisons…)                                                                                       | bottom |
| `window`        | sliding window: a bracket above the cards it covers plus a faint band, labeled with its value ("sum 13"); edges slide from the previous bound scene (`fromRange`)                       | canvas |
| `freq-table`    | character counts in the window, one cell per letter ("2"), or have/need ("1/1", ✓ when met); the changed letter gets a thick border and ▲                                               | bottom |
| `deque`         | Sliding Window Maximum's deque front → back (value + position); values removed this step crossed out and dashed, "◀ front" / "✕ back"; the maxima so far beside it                      | bottom |
| `search-range`  | binary search over a row: bracket over the cards still in play (notch over `mid`), dropped cards dimmed, dashed, ✕; a rotated list's sorted half tinted, "✓ sorted"                     | canvas |
| `number-line`   | binary search on the answer: one cell per candidate; ruled out dashed + struck + ✕, known to work solid + ✓, the tested `mid` thick with "▲ mid"                                        | bottom |
| `cut`           | a partition divider through a row (left side shaded) that slides between scenes; Median's two lists get one each                                                                        | canvas |
| `linked-list`   | node boxes in lanes with an arrow to each `next` (and `prev`, doubly linked), a "null" end, a dashed dummy; rewired links ghost and redraw, moved nodes slide; ids address nodes        | canvas |
| `binary-tree`   | a tree by depth: running call ringed, open path in orange, finished ✓ with "↑ 3", null stubs, values travel up edges                                                                    | canvas |
| `call-stack`    | recursion frames beside the tree, bottom to top: "depth(5) waiting for left", "returns 3"; pushed frames slide in                                                                       | canvas |
| `grid`          | BFS grid: cell glyph + word (≈ water, ■ wall), current ringed, frontier dashed, levels in corners, check arrows (✕ + reason)                                                            | canvas |
| `graph`         | BFS graph in columns by level from node 0: current ringed, frontier dashed, level labels, checked edges lit (✕ if seen)                                                                 | canvas |
| `queue`         | BFS queue front → back: dequeued fades struck out, enqueued slides in; a divider + "level 2" marker between levels                                                                      | bottom |
| `heap`          | priority queue: tree + backing array (one list), min/max, "size 2/2"; push sifts up and pop sifts down swap by swap; two side by side                                                   | canvas |
| `dp-table`      | DP table (row or grid, headers): unfilled cells dashed, current ringed, read arrows (winner solid), answer cell ✓                                                                       | canvas |
| `staircase`     | Climbing Stairs: numbered steps over table cells, a climber, the +1 / +2 hops onto the step as arcs                                                                                     | canvas |
| `house-row`     | House Robber: houses over table cells with their cash, neighbors linked (shared alarm), ✓ take / ✕ skip plan                                                                            | canvas |
| `stack`         | a stack column beside the input (bottom → top, top marked), push/pop animated, monotonic order label, resolve arcs + answers under the row; two side by side (`traceStack`)             | canvas |
| `search-tree`   | backtracking decision tree (any branching): path in orange, dead ends faded/folded, pruned stubs dashed + reason, solutions ✓                                                           | canvas |
| `partial`       | the answer being built as chips (the newest slides in, an undone one slides out struck) and the answers found so far                                                                    | bottom |
| `hash-map`      | hash map / set as rows (key → value, grouped buckets) or cells: lookup ringed with ✓ found / ✗ not found, new entries slide in, updates                                                 | bottom |
| `race`          | fast and slow pointers over a linked-list: hop arcs "+1" / "+2" along the links, the meeting node ringed (◎ meet), the loop's start (✓), the loop link in orange                        | canvas |
| `choice`        | a greedy decision: "✓" the option taken (solid green) beside "✕" the one turned down (dashed, struck), and a one-line reason it's safe                                                  | bottom |
| `reach`         | the stretch of a row a greedy scan has committed to: a band under the cards ("reach 5"), the step's jump arc over them ("+3"), closed pieces with lengths and cuts                      | canvas |
| `prefix-row`    | running totals under an item-row, one cell per boundary (cell i between items i − 1 and i): unbuilt dashed, built ringed, spans as brackets whose edges drop to their two cells (+ / −) | canvas |
| `prefix-grid`   | a small matrix beside its 2D prefix grid: rectangles added (+, solid accent) or subtracted (−, dashed) for inclusion-exclusion, signed prefix cells, a found rectangle ✓                | canvas |
| `timeline`      | intervals as bars on lanes over a number line: waiting, active, current, done, absorbed (merged in), removed (✕), result (✓); sorts slide, merges grow, overlaps shaded, a sweep marker | canvas |
| `bits`          | numbers as rows of bits in aligned columns (place values or bit meanings above), the operator before each result row, changed bits highlighted, shifts sliding, decimals beside         | bottom |
| `trie`          | a prefix tree of letter nodes by depth: word ends double-ringed with ✓ (and a note), the root-to-current path in orange, new nodes pop in, a missing child as a dashed ✕ stub           | canvas |
| `digraph`       | a directed graph at fixed spots: arrows with weights, in-degree badges ("in 2"), ready dashed, current ringed, done ✓, stuck ✕; edges new, used (faint), better ✓, worse ✕              | canvas |
| `union-find`    | union-find as trees: arrows up to parents, roots with "chief · 3", find paths lit, compressed links ghosted and redrawn, unions sliding trees together, a shared root ✕                 | canvas |
| `op-log`        | a design problem's calls in a column on the left ("put(1, 10)" and its output): finished solid, the running call ringed in the accent, later calls dashed; scrolls to keep it in view   | canvas |

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
   palette, row layout, `reducedMotion`, and `text`, and `enterProgress()`/`motion()` for animation. Every font size
   goes through `text.size(TEXT.<role>)` (add the role to `TEXT`); hide or abbreviate labels that don't fit.
   `useCurrentFrame()` is already local to the element's entrance (it's wrapped in a `<Sequence from={enterAt *
duration}>`).
4. **Register**: add `foo: { component: Foo, slot, layer }` to `primitiveRegistry` (typecheck fails until you do).
   If it needs its own region (for example a staircase replacing the row band), extend `layout.ts`.
5. **Resolve + validate**: if it carries algorithm state, fill it from the step in `resolve.ts` and check it in
   `validate.ts` (and add the state to `TraceStep` if it's new).
6. **Test**: add a schema test and, if validated, a "wrong storyboard fails" test. Add the type to the primitive list
   in `tests/video-text.test.ts` and a phone-width fit check for its text (in `src/video/fit/`, called from
   `sceneFitProblems`).

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
has a count-array. Final positions come from a step's `sorted` range (bubble, selection, insertion) or its `final`
set when they're scattered (quick sort marks exactly the placed pivots and one-value ranges, in any order);
`finalPositions(step)` reads either, and a `sorted-region` binds and is validated against it.

**Divide and conquer** (merge, quick, heap sort, Count Inversions) added step state for the recursion, all optional:
`range`/`depth` (the subarray being worked on), `segments` (the current split), `splitTree` (every level, for the
overview), `buffer` (a merge in progress), `pivot`/`boundary`, `heapSize`/`compare`, and `counter`. Merge sort and
Count Inversions share one runner (`traces/sorting/merge-steps.ts`): a taken front stays visible in its own step and
leaves its slot (dashed) from the next; the merged step's `moves` slide every value to its new slot. The layout
spreads groups apart and lowers the pointers under the brackets (`RowLayout.pointerTop`), puts the merge buffer under
the pointers (`panelTop`), reserves a strip above the bars for the pivot tag, and with a `heap-tree` gives the bars a
narrow left column (`HEAP_BARS`) so the tree gets most of the stage (`HEAP_TREE_REGION`) and stays readable when the
player is phone-sized. Floating callouts overlap the tree, so heap scenes anchor callouts to the bars. Each video fit
the 10-scene limit, so `MAX_SCENES` is unchanged.

**Sliding window** (all five problems) added step state `window` (`from`, `to`, optional `value`; `to = from − 1`
when empty), `freq` (`entries: { key, count, need? }[]`, `active`), and `deque` (`indices` front first,
`poppedBack`, `poppedFront`, `output`). Every video uses cards (item-row) with `left`/`right` pointers and the
`window` bracket; the layout reserves a strip above the cards for the bracket and its label (`sizes.window`, above the
highlight tags) and keeps it under a two-line caption, shortening the cards when a tall bottom stack needs the room.
Tones follow the verdict convention: a new best is positive whatever the sign (Minimum Window's shorter window is
`<`), "fits within k" is positive and "too many changes" negative (Character Replacement), not-better is neutral.

**Binary search** (all five problems) added step state `search` (`from`, `to`, optional `mid`, `sorted`: the
positions still in play; `to = from − 1` once empty, which marks the gap before `from`: Search Insert's answer),
`answers` (`min`, `max`, `low`, `high`, `mid`: candidates below `low` are ruled out, from `high` up known to work), and
`cuts` (`first`, `second`), plus an optional second list on the trace (`secondRow`) that an item-row shows with
`traceRow: "second"` (Median of Two Sorted Arrays). Bounds that move past either end aren't drawn (`onRow` drops them
from `pointers`). Tones: a candidate that fits is positive whatever the sign (Koko's `7 = 7` hours), too slow
negative; which half is sorted is neutral, the target inside it positive; a misplaced median cut negative. Plain
searches keep the sign colors (too low / too high / found). Two rows share the space between the caption and the
bottom stack.

**Linked lists** (all five problems) added step state `links` (`nodes`: every node's `id`, `value`, `next` (an id or
null), `lane`, `slot`, `dummy`; `rewired`: the links this step changed, `{ node, from, to }`) and `heap` (Merge K's
min-heap of heads, drawn by the existing heap-tree). Traces mutate a `ListState` (`traces/linked-list/shared.ts`) with
real `node.next = …` assignments, so every rewire is recorded where it happens. Node ids are fixed; `trace.row.values[id]`
is a node's value, `display: "list"`, and pointers and highlights refer to node ids (a null pointer is left out of
`pointers`). One `linked-list` element per scene holds every list as a lane: Reverse/Remove Nth/Reorder use one or two
lanes, Merge Two uses A, B, and the merged lane (taken nodes move into it and still point into their old list until
the next link), Merge K uses three input lanes on the left, the heap-tree on the right, and the merged lane across the
bottom. The layout (`layoutList` in `video/layout.ts`) stacks lanes with room above for each lane's pointers (which
stack upward when they share a node) and below for highlight tags (they go under the nodes) and skip arcs; a lane with
nothing in it collapses; when lanes need more height the bottom stack moves down. `RowLayout.tops` gives each node its
lane's height, so `pointer`, `highlight`, and pointer labels work unchanged. Arrows: neighbors to the right are
straight, back to the left neighbor straight on a lower track, skips curve under the lane, other lanes S-curve (or rise
into the target from below when it's behind). Tones: comparing two heads is neutral (Merge Two's `2 > 1` isn't bad
news). Gotcha: the element's fading wrapper is a full-stage box; a zero-size wrapper made Chrome skip painting the nodes
mid-animation.

**Trees (DFS)** (all five problems) added `trace.tree` (the shape: every node's `id`, `value`, `left`, `right`; ids are
level-order positions of the real nodes, `trace.row.values[id]` is a node's value, `display: "tree"`) and two pieces
of step state: `tree` (the walk: `current`, the running call; `nullVisit`, a call on a missing child; `path`, the open
calls from the root; `done`; `skipped`, nodes an early exit never visits; `returned`, a value handed up this step,
`{ to, side, value }`; `results`, what each finished call returned; `badges`, running state carried down, e.g. "sum 9")
and `stack` (frames bottom to top: `label` like "depth(5)" or "depth(∅)", `node`, `waiting` on a side, `returns`).
Traces drive a `TreeWalk` (`traces/trees-dfs/shared.ts`) exactly like the recursive reference solutions: `enter`,
`base` (a missing child answers at once, one step), `leave` (the frame shows `returns`, then pops); the top frame is
never "waiting". `treeArgs` caps examples at 8 nodes and 4 levels. Two primitives: `binary-tree` (nodes at their
position in a full tree, so left and right read correctly; nodes as large as the band allows and never narrower than
their widest value; a "null" stub only for the missing child being visited) and `call-stack` (a column right of the
tree, frames from the bottom; `kept` counts frames still open since the previous bound scene, the rest slide in;
notes fall back "waiting for left" → "wait: left" → "◀ left"). The tree asks the bottom stack to move down until it
gets full-size nodes, so tree scenes keep the bottom stack short (at most an equation and a counter; the answer scene
the result plus at most one more). On a phone-sized player only the running call's note shows, and a finished node
gets a double border instead of the ✓. Tones: Count Good Nodes' "not good" is neutral, Maximum Path Sum's new best is
positive and a worse bend neutral, Validate BST's out-of-range value negative. No problem in the pattern is
level-order, so there's no queue panel yet (a level-order problem would reuse `deque`).

**Graphs (BFS)** (all five problems) added `trace.grid` (`rows`, `cols`, starting `cells`, and a `legend`: each value's
glyph, word, and tone, so no cell state depends on color) or `trace.graph` (`nodes` with labels, undirected `edges`),
plus three pieces of step state: `cells` (the grid after a step that changes it: paint, rot), `bfs` (`current`,
`visited`, `frontier` = the queue's ids, `levels`, and `checks`: each neighbor check `{ from, to?, dir?, result }`,
where `result` is `added`, `visited`, `blocked`, or `out` (off the grid, `dir` only)), and `queue` (`items` front to
back, each with its `level`; `dequeued`; `enqueued`). Ids: a cell is `row * cols + col`, `trace.row.values` the cells
by id (or the graph's labels). Traces drive a `Bfs` recorder (`traces/graphs-bfs/shared.ts`) exactly like the
reference solutions (`enqueue` marks seen; one step per item taken off the queue, with all its checks); grids are at
most 5×6. Three primitives: `grid` (cells as large as the band allows, never narrower than their glyphs, with a rim
for off-grid arrows; check arrows appear one after another; reasons come from the legend word, "seen", or "edge", only
with ≤ 4 checks on a large player; on a phone a seen cell shows its level or ✓ in place of a symbol glyph), `graph`
(columns by BFS level from node 0, computed in `graphColumns`, so the layout never moves between scenes), and `queue`
(a bottom panel; a new primitive rather than a change to `deque`, which reads row values and carries Sliding Window's
output). The queue marks level boundaries: a divider between levels and a marker over each level's first item, words
set by `levelLabel` ("minute", "distance", "keys"); items carry their level, so the validator checks the boundaries
with the items. No comparison in these traces would mislead, so none sets a tone. Rotting Oranges is multi-source: every
rotten orange is queued at level 0 in the first step. As with trees, grid and graph scenes keep the bottom stack short.

**Heap / Priority Queue** (the five home problems; Merge K Sorted Lists, Sliding Window Maximum, and heap sort are
cross-listed in with their own videos) added step state `heaps`: one or two `{ kind: "min" | "max", items, capacity?,
swaps?, pushed?, popped? }`, where `items` is the backing array after the step (each `{ key, label }`: ordered by key,
shown as "9", "(-1,1)", "4 ×3") and `swaps` are the sift's swaps in order, so the start of the step is the array with
them undone. Traces drive a `RecordedHeap` (`traces/heap/shared.ts`) with the reference solutions' exact sift and tie
rules; a top-k heap may hold capacity + 1 for one step (push, then pop). The `heap` primitive is separate from
`heap-tree` (heap sort's frames are pixel-identical before and after it was added): each heap's tree (at the shape of
its largest size in the trace, `slots`, so it never jumps) and its array strip under it are the same list, and the
component replays the swaps one at a time in both (a pop first lifts the root out to the right and moves the last item
to the root). The name sits left of the array strip and the size ("size 3/2") right of it; two heaps get a title row
with their story names ("younger half (max)"). An input strip (item-row, short cards) can sit above the heap, marked
with an "active" highlight (no pointers: there's no room on a phone). The validator checks every heap against the step
(kind, array, capacity, swaps, push, pop: the tree is the array) and that every drawn heap keeps the heap property;
`isHeap` lives in `traces/types.ts`. An unbound heap is the final heaps. Tones: Last Stone Weight's equal stones are
neutral.

**Dynamic Programming** (the five home problems; Counting Bits and Jump Game are cross-listed in without videos)
added `trace.dp` (`rows`, `cols`, `rowHeaders`, `colHeaders`: a name like "ways" for a 1D table, or two strings'
characters with "" for the empty prefix) and step state `table` (`cells` with `null` for unfilled, `current`, `reads`:
the cells it reads, each labeled with its option, `chosen`: the reads the winning option used, `choice`, `answer`: the
answer cell), plus `climb` (Climbing Stairs: the climber's step and the hops onto it) and `houses` (House Robber:
the house being decided and the best plan so far, taken and skipped). Traces fill a `Table`
(`traces/dynamic-programming/shared.ts`) one cell per step, each read already filled (tested). Row displays
"stairs" and "houses" are drawn by the `staircase` and `house-row` primitives, column i over table cell i
(`layoutDp` gives them the region above a 1D table, asking the bottom stack to move down for it). Climbing Stairs
also carries `trace.tree`, the top four levels of plain recursion's call tree: its first two steps are tree walks
with `repeats` (a new optional binary-tree field, drawn with a dotted accent border; trees without it render exactly
as before) and, memoized, everything under a repeat `skipped`. A 1D table's reads are arcs over the row, labeled over
each read cell; a 2D table's are short arrows between neighbors; labels show for every option when there are two,
otherwise only for the winner. Cells are as wide as their widest value. 2D tables fill the stage on a phone, so their
answer card goes in the closing scene (the last step's scene shows the ✓ answer cell). Tones: House Robber's winning
skip is neutral. The validator checks the table's shape and headers, every cell, the current cell, reads, chosen
option, and answer, and the climber/hops and the street's plan; an unbound table is empty or final, and no plan may
take two neighbors (schema).

**Stack** (the five home problems; Trapping Rain Water, Min Stack, and Implement Queue using Stacks are cross-listed
in with their videos) added step state `pile` (named so it doesn't clash with a recursion's `stack`): `items`
bottom to top (each `{ label, ref?, key? }`: `ref` the input position, `key` what a monotonic stack orders by),
`order` ("increasing" | "decreasing"), `pushed` (how many at the top this step pushed), `popped` (in pop order),
`links` (answers the pops resolved, `{ from, to, label }` on the input row), `answers` (every one resolved so far),
and `text` (Decode String's string so far). Traces drive a `Pile` (`traces/stack/shared.ts`). The `stack` primitive is
separate from `call-stack` (the Trees videos' frames are pixel-identical before and after): a column on the right
(the input row moves left of it), pushes drop in, pops lift out struck through, "top ▶" on the top item, the
order in its title; under an item-row it draws the answers, the resolve arcs (dipping under the row, labeled "+3",
"match"), and the text strip, so stack scenes mark the current input with an "active" highlight, not a pointer.
The validator checks every field against the step, and that a stack labeled increasing or decreasing is (by key,
bound or not; `keepsOrder` in `traces/types.ts`). An unbound stack is empty. Largest Rectangle shades each popped
bar's rectangle with a bar-row `fill` that sets `cover` (whole bars, hatched in the accent) and a `label` (the area);
without them a fill is the water container, as before. Tones: a warmer day found is positive and one that isn't
neutral (Daily Temperatures); a new best area positive, a smaller one neutral.

**Backtracking** (the five home problems; Word Search II and Design Add and Search Words are cross-listed in without
videos, and Subset XOR is also listed under Bit Manipulation) added `trace.searchTree` (every node of the decision tree:
`id`, `parent`, `label` (its state: litres left, the XOR so far, "c2"), `edge` (the choice: "+4", "skip"), `pruned` (the
reason a branch was cut)) and step state `explore` (`reached`, `path` from the root, `current`, `dead`, `solutions`,
`undone`: the node just stepped back from, `collapsed`: finished subtrees without an answer, folded into their root)
and `partial` (`items` being built, `added`/`removed`: the choice just made or undone, `found`). Traces drive a
`Search` (`traces/backtracking/shared.ts`): `choose`, `prune`, `solve`, `undo` mirror the reference solutions, and
nodes are created as they're reached, so the finished list is the whole tree. The `search-tree` primitive is separate
from `binary-tree` (the Trees, DP-recursion, and BFS videos' frames are pixel-identical before and after) and lays out
only the visible nodes: leaves spread evenly in the order they were reached, parents centered, folded subtrees hidden,
so a tree grows scene by scene. Choice labels show only when the levels have room for them; reasons sit under pruned
stubs (both hidden on a phone, where dashes, ✕, and borders carry it). `partial` is a bottom panel, one row on a phone
("✓ N" counts the answers). N-Queens reuses `grid` for the board ("♛ queen", "× attacked"; the square being tried is
the grid's current cell), which then takes the left of the stage (`layoutGrid`'s area) and the tree the right. Trees
five levels deep (N-Queens) fill the stage on a phone, so their answer card goes in the closing scene. The validator
checks the tree's shape and every search field against the step, and the answer being built (items, added, removed,
found); an unbound tree shows the root (or the final search) and an unbound answer is empty. Tones: Combination Sum's
too-big candidate is negative (the branch is cut).

**Arrays & Hashing** (the five home problems; Longest Substring Without Repeating Characters and Top K Frequent
are cross-listed in with their videos, as are LRU Cache, LFU Cache, Subarray Sum Equals K, and Number of Submatrices
That Sum to Target, and First Missing Positive is also listed under Sorting) added step state `map`: `kind` ("map" |
"set"), `display` ("rows": one "key → value" line per entry, a group's items in the value; "cells": compact chips),
`entries` in insertion order, `lookup` (the key asked for and whether it was there), `inserted`, and `updated` (with
its old value). Traces read and write a `RecordedMap` (`traces/arrays-hashing/shared.ts`) like the reference
solutions do. The `hash-map` primitive is a bottom panel under the input: the key looked up is ringed with "✓ found"
or "✗ not found" (a key that isn't there shows as a dashed ghost), a new entry slides in marked "new", an updated
value shows its old value struck through. Above a hash map, the input row sits under the caption with full-height
cards when there's room (their labels are positions the map refers to), shrinking on a phone. Group Anagrams keys each
word by its letters in order ("opst"; the reference counts letters: the same grouping); Valid Anagram shows its two
words as two item-rows and one count map; First Missing Positive is a cyclic sort on a `bar-row` (its existing swap
moves and final positions). Every video's second scene contrasts the slow way (a nested loop or a sort) with one
lookup. The validator checks the map's kind, display, entries in order, lookup and result, inserted and updated keys
against every step; the schema rejects a lookup whose result disagrees with the entries, and a set with values. An
unbound map is empty. Tones: a lookup that finds nothing is neutral; a found partner or a new longest run positive.

**Fast & Slow Pointers** (the five home problems; Reorder List is cross-listed in with its video; Cycle, Cycle II, and
Middle are also listed under Linked List, Find the Duplicate under Binary Search) added step state `race`: `phase` (1:
slow takes 1 hop and fast 2 until they meet or fast runs off the end; 2: one restarted at the head, both 1 hop),
`moves` (each pointer's `from`, `path` through the nodes it passed, `to` (null: off the end), `hops`, and `blocked`: a
node it refused to step onto), `meet`, `entry` (the loop's start, once phase 2 finds it), and `loop` (the link that
closes the loop). Traces drive a `Race` (`traces/fast-slow-pointers/shared.ts`) over a `ListState`: `move` follows real
`next` links hop by hop. Arrays read as lists use the same view: Find the Duplicate draws the indices the walk from 0
reaches, in walk order (index i → nums[i]); Circular Array Loop draws every index in order, labeled with its index and
jump ("3:+3"), refused jumps the other way, and rules out a failed start's path with a `rejected` highlight. The
`race` primitive is drawn over the `linked-list` (whose frames are pixel-identical before and after; the link geometry
moved to `video/list-links.ts`): hop arcs above the pointers (slow's at the first level in the accent, fast's at the
second, neutral), "+N" over the last hop (fast's moves to its first hop when both end on one), the meeting node ringed
dashed sky with "◎ meet", the loop's start ringed solid green with "✓ loop start" (the words from `meetLabel` /
`entryLabel`), and the loop link traced in the accent with "↺ loop". The layout (`layoutList`, only with a race)
reserves the hop strip, two pointer levels, and a marker row under the loop arrow in every scene, so the lane never
jumps; on a phone-sized player the labels and the marker row are dropped (humps show the hops; a dashed ring is the
meeting, a solid one the loop's start). The schema checks every move follows the scene's links (a move refused at
once stays put with 0 hops, drawn as just its ✕) and the loop is a real link; the validator checks phase, moves,
meet, entry, and loop against the step (an unbound race shows no moves).
Cycle II and Find the Duplicate meet away from the loop's start (tested), and their restart scene explains why phase
2 works with an equation of the two distances (head → start = meet → start; when fast lapped slow more than once,
`restartEquation()` shows meet → start plus the whole laps instead). Tones: the gap closing to 0 is positive,
other rounds neutral.

**Greedy** (the five home problems; Non-overlapping Intervals is cross-listed in without a video; Jump Game is also listed under Dynamic Programming, Partition Labels under Intervals) added step
state `choice` (`chosen`, the option the step takes, and `rejected`, the one it turns down, in the problem's terms:
"$10 + $5" vs "$5 + $5 + $5", "start at 3" vs "start at 1–2") and `reach` (`from`/`to`: the stretch committed to,
Jump Game's reachable prefix or Partition Labels' open piece, `to = from − 1` once it's cut; `value`, the farthest
index even past the end; `jump`, this step's arc from the current item with a label; `pieces`, the closed pieces).
Two primitives, built apart from everything else: `choice`, a bottom panel ("✓" solid green, "✕" dashed and struck,
then `reason`: why the choice is safe, in the story's words; written by the storyboard, not checked, and hidden on a
phone, where the options stack when they don't fit side by side; an unbound choice is free text, for the slow-way
contrast), and `reach` over an item-row (a band in the accent under the cards, labeled inside it or beside it, closed
pieces as green brackets with their lengths and a dashed cut after each, the jump arc over the highlight tags, and
`dimBeyond` dashing the cards out of reach; `layoutRows` reserves the arc strip above and the band below, only with a
reach). Their geometry lives in `video/greedy-layout.ts`, shared with the fit checks. The rest is reused: Lemonade
Change's till is a `freq-table` ("$5", "$10"), Gas Station's tank a `counter` (a drop now shows "−3", which no earlier
video had) over two item-rows (fuel, and the cost to the next stop as `traceRow: "second"`), Partition Labels' last
positions a `hash-map` (cells), and Candy a two-row `dp-table` ("left", then "both": the larger of the left count and
the right neighbor's + 1). Lemonade Change and Gas Station got new first examples that make the decision matter (a $20
paid with $10 + $5 leaves the $5 the last customer needs; a start that runs dry two stops in, so two stops are
skipped). The validator checks a choice's options and every reach field against the step (a reach needs a bound
step). Every video's second scene contrasts trying every option with one greedy pass, and its key decision says why
the choice is safe, in the narration and the choice's reason. Tones: a jump that doesn't beat the reach is neutral, a
farther one positive; change handed back neutral, a customer who can't get change negative; the fuel check positive
when total gas covers total cost.

**Prefix Sum** (the five home problems; Subarray Sum Equals K and Number of Submatrices That Sum to Target are also
listed under Arrays & Hashing; no other pattern's problems are listed under Prefix Sum) added step state `prefix`: one
or more running-total rows (`name`: "prefix", "left", "right"; `op`: "+" or "×"; `direction`: prefix, or suffix for
products of the items from i on; `values`, one per boundary, `null` until built; `current`, `reads`, and `spans`:
items `from`…`to − 1` answered by the cells at `from` and `to`, with the value) and `prefixGrid` (the 2D grid with its 0
row and column, the cell built or read, the matrix rectangles added or subtracted, the signed prefix cells standing
for them, and a `found` rectangle), plus `trace.matrix`. Traces build a `PrefixRow` (`traces/prefix-sum/shared.ts`).
Two primitives, built apart from everything else: `prefix-row` sits under its item-row's pointers with cell i centered
on the boundary before item i (`boundaryX` in `video/prefix-layout.ts`), so a span's bracket over the items has its
edges exactly over its two cells (dashed guides drop to them, and for sums the later cell is marked "+" and the earlier
"−"): the off-by-one is on screen. Up to two per item-row (Product's "before ×" and "after ×": each answer is the two
cells flanking its item); `layoutRows` reserves the bracket strip above the cards and one band per row under the
pointers, only with a prefix row. `prefix-grid` draws the matrix and its prefix grid side by side, matrix row r level
with prefix row r + 1, rectangles inset so stacked ones stay apart, each sign on its rectangle's corner. Reused: the
hash map of prefixes seen (Subarray Sum, Submatrices; a map per row pair), equation, counter, result. The schema
checks a row has one cell per boundary, a sum's span equals the difference of its cells, spans over one row don't
overlap, and rectangles and cells lie inside the grid; the validator checks every field against the step (an unbound
row is empty or final, an unbound grid unbuilt or complete). The answer scene beside a map keeps to the input, the row,
and the result: at phone width the map and an equation don't fit with it. Tones: Pivot's unequal sides are neutral,
equal positive; a lookup that finds nothing is neutral, a match positive.

**Intervals** (the five home problems; Partition Labels is cross-listed in with its video; Minimum Interval to Include
Each Query is also listed under Heap, Non-overlapping Intervals under Greedy) added `trace.timeline` (the axis `min`/`max`,
the lane count, and the intervals as given, `input`) and step state `timeline`: every bar (`id`, `start`, `end`, `lane`,
`state`: waiting, active, current, done, absorbed, removed, result; `fromLane` when a sort moves it), the `overlap` of
this step's two intervals, a bar that grew this step and the extent it grew from (`grow`: a merge), and a `sweep`
marker (the query point, "free from 3"). Traces drive a `Timeline` (`traces/intervals/shared.ts`). The `timeline`
primitive is built apart from everything else (`video/timeline-layout.ts`): lanes under the caption with a strip for
the sweep label, the axis with tick labels that thin out until they fit, bars labeled "[4, 7]" inside or beside them
(never onto another bar on the lane), every state carried by fill, border style, and glyph; on a phone-sized player
bars are slim and unlabeled (the axis, the equation, and the caption carry the numbers). Meeting Rooms here is "can
one person attend every meeting" (sort, then neighbors), so the only heap is Minimum Interval's min-heap of
"size·right": it reuses `heap` and `partial` (the answers, with `showFound: false`: a partial option, default on, that hides the found row and its phone-width "✓ N" count, which mean nothing there; the Backtracking videos are pixel-identical before and after), and the heap takes the right of the stage beside the
timeline (`layoutHeaps` got an optional region whose default is the full width; the Heap videos and heap sort are
pixel-identical before and after). Meeting Rooms got a first example with both a gap and a clash. The validator checks
the axis, lanes, every bar, the overlap, the growth, and the marker against the step (an unbound timeline shows the
intervals as given, or as they end). Tones: a merge's overlap is neutral, a meeting clash negative, a gap or
back-to-back meeting positive; a removed workshop negative, a kept one positive.

**Bit Manipulation** (the five home problems; Subsets and Sum of All Subset XOR Totals are cross-listed in with
their videos; Counting Bits is also listed under Dynamic Programming, Shortest Path Visiting All Nodes under Graphs
(BFS)) added step state `bits`: a fixed `width`, optional `bitLabels` (what each bit means, most significant first),
and rows, each a `name`, a `value` (its low `width` bits are drawn, the decimal beside them), the `op` that made it
("^", "^x &~twos", ">> 1"), `rule` for a result, the bit positions it `changed`, and `from` (the value whose bits slide
`shift` places into it). The `bits` primitive is a bottom panel built apart from everything else
(`video/bits-layout.ts`): a header of place values or bit labels, then rows of name, operator, bit cells in aligned
columns, and "= decimal"; result rows appear a beat later under a rule; changed bits get a thick accent border; 1s
are bold, 0s muted; shifted bits slide in from their old columns. `rowLabels` rename rows in the story's words (display
only). Widths stay at 5 bits or fewer, so the panel reads on a phone; with an input row or a table above it, the
answer's result goes in the closing scene, where the panel isn't. Reused: Counting Bits' answers are a one-row
dp-table (its read arrow "i>>1"); Shortest Path draws its nodes as cards whose values are their neighbors ("1,2,4"), the
walker as a pointer, and visited nodes as found (the graph primitive needs about 440 px for three nodes in a column on
a phone), and follows the BFS's winning walk level by level with the mask's OR, plus a counter of states per level.
Sum of Two Integers got a first example with three rounds of carries (5 + 7). Single Number II says what ones and twos
are (each bit's count modulo three: seen once, seen twice) before why triples clear. The validator checks the width
and every row (name, value, operator, rule, changed bits, slide); a bits panel needs a bound step. No comparisons, so
no tones.

**Trie** (the five home problems; none is cross-listed in; Implement Trie and Design Add and Search Words are also
listed under Data Structure Design, Design Add and Search Words and Word Search II under Backtracking) added step state
`trie`: every node (`id`, `parent`, `letter`, `end`, an optional `note` such as the root or word it holds; node 0 is
the root), the `path` from the root to the current node, nodes `created` this step, a `missing` child (looked for, not
there), wildcard `branches` still in play, `hits` (nodes completing a word this step), and `pruned` nodes (removed,
drawn fading out). Traces drive a `RecordedTrie` (`traces/trie/shared.ts`) exactly like the reference solutions. The
`trie` primitive is built apart from everything else (`video/trie-layout.ts`): levels top-down, children in creation
order, leaves (counting pruned nodes and the missing stub, so nothing jumps) spread at most a few node widths apart and
centered, parents over their children, levels spaced up to an ideal gap (its overflow is measured against that gap, so
the bottom stack moves down when it can). Above a trie an input row is a short strip under the caption (as with a heap,
table, or search tree), marked with an "active" highlight, not a pointer; beside a board (Word Search II's `grid`), the
board takes the left of the stage, as it does beside a search tree (N-Queens is pixel-identical before and after).
Word Search II marks its board path with the grid's `frontier` outline and the current cell ring (a `visited` cell
swaps its letter for ✓ on a phone). Results being built use `partial` with `showFound: false`; the answer's result goes
in the closing scene, since a trie five levels deep fills a phone. Replace Words shows its sentence in an info card and
not an item-row ("unchanged" doesn't fit a card on a phone). Longest Common Prefix, Implement Trie, and Word Search II
got first examples small enough for a phone (at most 8 nodes, 5 levels) that still show a shared prefix, a prefix
that isn't a word, and a miss. The validator checks every node (letter, parent, end, note), the path, and the created,
missing, branch, hit, and pruned nodes; the schema checks the path follows edges, siblings don't share a letter, and a
missing child really is missing. An unbound trie is empty (the root) or the final trie. No comparisons, so no tones.

**Advanced Graphs** (the five home problems; Number of Islands is cross-listed in with its video; Course Schedule and
Find if Path Exists are also listed under Graphs (BFS), Network Delay Time under Heap) added step state `network` (a
directed graph after the step: every node's `label`, fixed spot `x`/`y` on a small grid, optional `badge` ("in 2"), and
`state`: idle, ready (in the queue or heap), current, done, stuck (on a cycle); every edge's `weight` and `state`: idle,
new (found this step), used (removed by Kahn's algorithm), better / worse (a relaxation that did or didn't improve))
plus `trace.network` (the graph as given, what an unbound digraph shows), and `forest` (union-find: `labels`, `parents`,
`sizes` when unioning by size, this step's `finds` (each the parent chain from an element to its root, as it stood
before that find's halving), `compressed` links (`node` from → to), the `union` (a root now pointing at another
root), and `same` (the root two elements already share)). Traces drive a `Network` and a `Forest`
(`traces/advanced-graphs/shared.ts`): Kahn's algorithm, Dijkstra, and union-find exactly like the reference
solutions (path halving `parent[x] = parent[parent[x]]`; Find if Path Exists unions by size, Redundant Connection
doesn't). Dijkstra keeps a table of best times and pushes only improvements (the reference pushes every unsettled
neighbor; same answers, tested), so a relaxation that loses is visible; stale pops are skipped. Spots come from
`layers()`: columns by hops from the sources, nodes with no edges on a row of their own, so nothing moves between
scenes. Two primitives, built apart from everything else: `digraph` (`video/network-layout.ts`; the BFS `graph` is
untouched) draws circles as large as their labels need, a badge tag up and right of each node (just its number on a
phone), and quadratic edges: straight, bowed apart for a pair of opposite arrows, arched away from the middle when an
arrow points left (Course Schedule's 3 → 1), and bowed around any node in the way; weight pills sit on the curve
with ✓ / ✕ for better / worse. `union-find` (`video/forest-layout.ts`) lays the trees out twice, before and after the
step's work (the union undone, compressed links pointed back), at one scale, and slides between them a beat into the
scene; find paths are lit from the start, a rewired link ghosts out dashed as its shortcut draws in, roots carry a note
("chief · 3"; the size alone on a phone), a shared root gets a dashed rose ring and ✕; with an empty bottom stack the
trees use the stage down to its bottom margin. Reused: queue (Kahn's ready list, `levelLabel` "round": a node's round
is how many takes deep it was freed), partial (the order, `showFound: false`), heap (Dijkstra's (time, server)
candidates, on the right of the stage beside a graph, `NETWORK_SPLIT`, narrow enough that a popped root stays on the
stage; the five Heap videos, heap sort, and Minimum Interval are pixel-identical before and after: every paused frame
at 1280 and 375 px matched up to the capture's own antialiasing noise), hash-map cells (best times: an improvement shows the old time struck),
equation, item-row (the words, or the edges as cards). Course Schedule and Network Delay Time got first examples that
show a cycle (two courses taken, three stuck) and a relaxation that improves, one that doesn't, and a stale entry;
Find if Path Exists got one where union by size matters and the query compresses a path. The schema checks a digraph's
ids, spots, and edges (no duplicates, no self-loops) and that a union-find's parents form a forest, before and after,
that each find follows parent links to a root, and that a union joins two roots; the validator checks every node,
badge, edge, and state, and every parent, size, find, compression, union, and shared root, against the step (unbound:
the graph as given or as it ends; every element alone or the final forest). Tones: an improvement is positive (`<`), a
loss or a stale pop neutral; a size comparison neutral; fewer courses taken than exist negative.

**Data Structure Design** (the five home problems; Implement Trie, Design Add and Search Words, and Find Median from
Data Stream are cross-listed in with their videos; Min Stack and Implement Queue using Stacks are also listed under
Stack, LRU Cache and LFU Cache under Linked List and Arrays & Hashing, Time Based Key-Value Store under Binary Search)
added `trace.ops` (every call in order as shown, `{ call, output }`: "put(1, 10)" → "—", "get(1)" → "10", strings
quoted, `null` as "—") and step state `op` (`current`, the call this step belongs to, and `returned`, set on the step
where its output is known; a call may take several steps, e.g. TimeMap's binary search) plus `secondPile` (a second
stack beside `pile`: the queue's out stack). Traces replay `[operations, arguments]` exactly like the reference
solutions through `Calls` and record the design's internals with the existing recorders (`Pile`, `RecordedMap`, which
gained `delete` for evictions) and a new `DoublyList` (`traces/design/shared.ts`): real `prev`/`next` assignments per
lane, no sentinels (a lane's head and tail stand in for them), node ids in creation order and never reused, so a cache
that evicts a node leaves its id unused (the schema now asks for distinct ids, not 0…n-1, and every link must reach a
real node; `layoutList` indexes positions by id, identical for contiguous ids). Each structure is drawn by an existing
primitive: Min Stack's (value, min) pairs in a `stack`; the queue's in and out stacks as two `stack` elements (the
second with `traceStack: "second"`); LRU's map (`hash-map` rows, key → value) and recency list (`linked-list`, front =
most recent, nodes "key:value"); LFU's map (key → "70 ×1": value and uses), one lane per use count (an LFU bucket is a
small LRU list, oldest first; a used key slides to the next lane), and a `counter` for the fewest uses; TimeMap's map
(key → "4 entries", the history's length) and the one set key's history as an item-row (timestamps as values, the stored values as
labels) with a `search-range`. An eviction is its own step, the outgoing node marked `rejected`, before the insert.
A linked list's nodes may carry `prev` (a doubly linked list): the list then draws each back link on the lower track
and raises the forward arrows (`DOUBLY_NEXT`); lists without `prev` are drawn exactly as before. The `op-log`
primitive is built apart from everything else (`video/oplog-layout.ts`): a column at the left, as wide as its widest
call and output (all outputs count, so it never changes width), at most 42% of the stage, rows windowed to keep the
running call and the next one in view ("calls 5–10 of 11" in the title, hidden on a phone); when the full form is too
wide it drops spaces and quotes, and then a key every call shares and the outputs' quotes (`get(4)` beside a map that
shows "color"). With an op log the rest of the scene moves right of it (rows, list lanes, and stacks start at
`stageLeft`; each stack gets an equal share and keeps its title on a phone), and the bottom stack moves as far down as
it can (two stacks get their own columns with or without an op log). These are gated on the op log or a second stack,
so every earlier video is pixel-identical before and after: the 15 videos with a linked-list or a stack, every scene
paused at its start, +5 s, and +10 s at 1280 and 375 px in dark mode (and two of them in light mode), matched up to
antialiasing at shape edges, as much as recapturing the same commit varies. The validator checks the op log's
calls and outputs against `trace.ops`, the running call, and how many outputs are shown (unbound: none or all), the
second stack against `secondPile`, and each node's `prev`. The op log with every output filled in reveals the answer
(the list of outputs is too long for a result card on a phone), so these videos close with an info card. Every
video's second scene contrasts a simpler design with the combination; tones: Min Stack's new minimum is positive and
keeping the old one neutral, TimeMap's entry at or before the query positive and a later one neutral. On a phone a
doubly linked list keeps its lane names (LFU's "1 use", "2 uses": nothing else tells the lists apart), and a stack
beside an op log tags popped items "off", not "out" (a queue's stacks are named "in" and "out"); lists and stacks
elsewhere are unchanged. Time Based Key-Value Store marks its answer with the search range's "answer" marker only: a
"found" highlight on a card the empty range has already ruled out read as both crossed out and matched.

`bar-row` was added this way for Container With Most Water and Trapping Rain Water. Planned primitives (not built):
`coin-set` (Coin Change uses an item-row), `box-arrow` (system design).

## Traces and validation

`src/lib/traces/<pattern>/<slug>.ts` is an **instrumented solution**: a pure function that runs the algorithm on one
input and returns a `Trace` (types in `traces/types.ts`):

```ts
Trace = {
  problem: "pattern/slug", row: { values, display: "cards" | "bars" | "list" | "tree" | "grid" | "graph" | "network"
  | "stairs" | "houses" },
  secondRow?: { values },
  pointerNames,
  steps: { kind, key, pointers: { left: 0, right: 6 }, note, equation?, active?, rejected?, found?, fill?, water?,
           values?, moves?, empty?, sorted?, final?, held?, counts?, // algorithms that rearrange the array
           range?, depth?, segments?, splitTree?, buffer?, pivot?, boundary?, heapSize?, compare?, counter?,
           window?, freq?, deque?,                                // sliding window (see "Sliding window" above)
           search?, answers?, cuts?,                              // binary search (see "Binary search" above)
           links?, heap?,                                         // linked lists (see "Linked lists" above)
           tree?, stack?,                                         // trees (see "Trees (DFS)" above)
           cells?, bfs?, queue?,                                  // breadth-first search (see "Graphs (BFS)" above)
           heaps?,                                                // priority queues (see "Heap / Priority Queue" above)
           table?, climb?, houses?,                               // dynamic programming (see "Dynamic Programming" above)
           pile?,                                                 // stacks (see "Stack" above)
           explore?, partial?,                                    // backtracking (see "Backtracking" above)
           map?,                                                  // hashing (see "Arrays & Hashing" above)
           race?,                                                 // fast and slow pointers (see "Fast & Slow Pointers" above)
           choice?, reach?,                                       // greedy (see "Greedy" above)
           prefix?, prefixGrid?,                                  // prefix sums (see "Prefix Sum" above)
           timeline?,                                             // intervals (see "Intervals" above)
           bits?,                                                 // bit manipulation (see "Bit Manipulation" above)
           trie?,                                                 // tries (see "Trie" above)
           network?, forest?,                                     // advanced graphs (see "Advanced Graphs" above)
           op?, secondPile? }[],                                  // design (see "Data Structure Design" above)
           // range…counter: divide and conquer (see "Divide and conquer" above)
  //   equation = { terms, operator, result, comparison?: { op, target }, tone?: "positive" | "negative" | "neutral" }
  tree?: { nodes },    // a binary tree's shape (display "tree"); steps record the walk over it
  grid?: { rows, cols, cells, legend }, graph?: { nodes, edges },   // a BFS's grid or graph
  dp?: { rows, cols, rowHeaders?, colHeaders? },                     // a DP table's shape
  searchTree?: { nodes },                                            // a backtracking decision tree
  matrix?,                                                           // a prefix grid's matrix
  timeline?: { min, max, lanes, input },                             // an interval trace's axis and intervals
  network?,                                                          // a directed graph as given (unbound digraphs)
  ops?: { call, output }[],                                          // a design problem's calls (what an op-log shows)
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
  step's own array when it has one (`values`), and moves, empty slots, sorted regions, held values, tallies, groups,
  split trees, merge buffers, partitions, heaps (values, size, compared pair, moves), counters, windows, character counts, deques, search ranges, candidate answers, cuts, linked lists (every node's link, back link when it has one, lane, and slot; rewired links; where moved nodes slide from), heaps (kind, array, capacity, swaps, push, pop; every drawn heap keeps the heap property; an unbound one is the final heaps), DP tables (shape, headers, every cell, the cell being computed, its reads, the chosen option, the answer cell; an unbound one is empty or final) with their staircase (climber, hops) or street (taken and skipped houses), stacks (items bottom to top, push, pop, resolve links, answers, built text; one labeled increasing or decreasing must be; an unbound one is empty), hash maps (kind, display, entries in order, the lookup and its result, inserted and updated keys; an unbound one is empty), races (phase, every move's path and hops, a refused node, the meeting node, the loop's start, the loop link; every move follows the list's links; an unbound one shows no moves), greedy choices (the option taken and the one turned down; an unbound choice is free text) and reaches (range, value, jump, closed pieces; a reach needs a bound step), prefix rows (op, direction, every value, the cell built, reads, spans and their values; one cell per boundary; an unbound row is empty or final) and prefix grids (the matrix, every prefix cell, the current cell, signed rectangles and cells, the found rectangle; unbound: unbuilt or complete), timelines (axis, lanes, every bar's range, lane, state, and slide, the overlap, a merge's growth, the sweep marker; unbound: as given or as they end), bits panels (width, and every row's name, value, operator, rule, changed bits, and slide; a bits panel needs a bound step), tries (every node, the path, created, missing, branch, hit, and pruned nodes; unbound: empty or final), digraphs (direction, every node's label, spot, badge, and state, every edge's weight and state; unbound: as given or as it ends) and union-finds (labels, parents, sizes, finds, compressed links, the union, the shared root; unbound: every element alone or the final forest), op logs (every call and output, the running call, how many outputs are shown; unbound: none or all; all shown reveals the answer) and a second stack (`traceStack: "second"`, against the step's `secondPile`), search trees (shape, reached, path, current, dead ends, solutions, undo, folded subtrees) and the answer being built (items, the choice added or removed, answers found; unbound: the root and an empty answer, or the end), BFS grids and graphs (shape, legend, cell contents, and the search: current item, seen set, frontier, levels, neighbor checks; an unbound one shows no search or the final search), queues (items with their levels, so the level boundaries; what left the front and joined the back; a queue needs a bound step), trees (the shape, and every walk field: running call, null visit, open path, finished, skipped, returned value, results, badges), and call stacks (frames, and `kept` against the previous bound step) match the step (a `traceRow: "second"` row holds the second list; an unbound list must be the starting or final one; an unbound tree is bare or the final walk, and a call-stack needs a bound step); `result.indices` equal
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
rule and a test forbid importing `@/lib/generation`, `ai`, or `@ai-sdk/*` from app code. The one exception is the
tutor (`src/lib/tutor`, below), which may use the AI SDK server-side (its modules that do import `server-only`) and
still can't import the generator.

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
  The log resets on save, so a re-save (`--force`) adds the failures since then to the count already recorded on the
  saved storyboard (when this fallback wrote it): the count never drops.
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

## Narration

Every video's narration is spoken: by its stitched ElevenLabs track when it has a current one, otherwise by the
browser's built-in voice (Web Speech API), otherwise not at all (captions and the transcript carry it).

**One continuous track per video.** The player plays ONE audio element per video whose position is the video's time.
Scene changes never touch it (no new source, no restart, no pause), so visual transitions (cross-fade, highlights)
happen on top of continuous narration. Per-scene clips that switched source at every boundary used to start
0.1–0.44 s late over the network, and the old drift correction then skipped the first ~0.33 s (a cut-off first word)
or played 8% fast for seconds to catch up; a single track removes the switch altogether.

**Pipeline (offline, `pnpm generate:narration`).** `scripts/generate-narration.ts` → `src/lib/generation/narration/`
(covered by the same ESLint rule and test that keep generation code out of the app):

```bash
pnpm generate:narration --storyboard two-pointers/pair-with-target-sum --storyboard sorting/heap-sort --dry-run
pnpm generate:narration --pattern sorting          # every sorting video
pnpm generate:narration --missing                  # every video with a scene not voiced yet, or a stale track
pnpm generate:narration --stitch-only              # rebuild stale tracks from existing clips: no requests, no key
#   --storyboard <id or pattern/slug>   repeatable    --max-chars <n>   default 9000    --dry-run   call nothing
```

1. **Clips.** One request per scene: `POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_64` with `model_id`,
   over plain `fetch` (`elevenlabs.ts`). Model `eleven_flash_v2_5` (cheapest per character), voice "Sarah"
   (`EXAVITQu4vr4xnSDxMaL`, a default voice the free plan can use through the API). For continuity each request sends
   ElevenLabs' request-stitching context: `next_text` (the next scene's narration) and either
   `previous_request_ids` (the `request-id` headers of up to 3 adjacent scenes voiced just before it in this run;
   ElevenLabs keeps them 2 hours) or, when there are none, `previous_text`. Clips are saved to
   `narration/clips/<storyboard>/<scene>-<hash>.mp3` (committed, **not** served: they're the stitching source), where
   `hash = narrationHash(narration, voice)` (`lib/narration/hash.ts`). Unchanged narration is never paid for twice;
   an edited scene gets a new clip and the old one is deleted. What ElevenLabs bills (`character-cost` header, else
   the text length) counts against the budget.
2. **Stitching** (`stitch.ts`, pure functions over PCM; `ffmpeg.ts` decodes and encodes). Each clip is decoded,
   trimmed of true silence only at its edges (below −50 dBFS, keeping a 30 ms margin, so speech is never cut), and
   joined: `TRACK_LEAD_MS` (300 ms = `NARRATION_LEAD_FRAMES`) of silence, clip 1, a 600 ms pause, clip 2, …, a 600 ms
   tail. It's encoded once (96 kbps, through a temp file so the LAME header records the encoder delay; through a pipe
   every offset came out 25 ms late) to `public/audio/<storyboard>/narration-<hash>.mp3` (the hash covers every clip's
   hash and the stitch settings, `STITCH_VERSION`). The result is decoded again and checked (`checkTrack`): its
   length must equal lead + speech + pauses + tail, and every clip must be found whole, where it was placed (±2 ms),
   by cross-correlation (≥ 0.97). A track that fails isn't recorded. Needs ffmpeg (`brew install ffmpeg`, or
   `FFMPEG_PATH`); builds don't, since tracks are committed.
3. **Manifest** (`src/content/narration/manifest.json`, version 2): per storyboard, `clips` (scene → hash, file,
   length, characters, voice) and `track` (file, hash, length, and per scene its id, clip hash, `startMs`, `speechMs`).
   Written after every clip and every track, so a stopped run keeps what it saved.

- **Budget.** The free plan is ~10k credits/month ≈ 20k characters on Flash; a video is ~900–1,950 characters.
  `--max-chars` (default 9000) is checked before each video (voiced whole or not at all) and each request. A dry run
  prints characters per video and which tracks need stitching, and names the one video to drop if over budget.
- **Errors.** Quota exhausted and 402 stop the run; 429, 5xx, timeouts, and dropped connections retry with backoff
  (5s, 15s, 45s, or `retry-after`), then stop as "unavailable"; a bad key (401) aborts; a refused request (400/422)
  or a failed track check fails that video. Exit codes 0 / 1 / 2 (`narrationExitStatus()`).
- Config (`.env.local`, never printed or committed): `ELEVENLABS_API_KEY` (not needed for `--dry-run` or
  `--stitch-only`), optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `ELEVENLABS_DELAY_MS` (500),
  `ELEVENLABS_TIMEOUT_MS` (60000), `FFMPEG_PATH`.

**Timing: the video follows the audio.** `content/storyboards/index.ts` passes every storyboard through
`withNarration(storyboard, manifest)`. When the track covers exactly the storyboard's scenes, in order, each voiced
from its current narration (`currentTrack`), the storyboard gets `narrationTrack: { src, durationMs, sceneStartsMs }`
and scene lengths from `trackSceneDurations()`: scene i's narration start (`timings[i].narrationStart`, also where
scene jumps land) is exactly its speech start in the track, and the video ends with the track. Any change (a scene
reworded, added, removed, reordered) drops the whole video to the browser voice with estimated lengths until it's
restitched; there's no partial voicing.

**Playback (`NarrationEngine`, `lib/narration/engine.ts`; wired by `components/learn/use-narration.ts`).** The
Player is the clock. Frame updates, seeks, play/pause, and store changes (speed, volume, mute, hold) call
`engine.update()`:

- ElevenLabs track: the source is set once. The target position is `frame / fps`. On play, resume, a seek or scene
  jump, a stall (`readyState < 3`), or drift past `DRIFT_SECONDS` (0.5 s, e.g. a background tab), the engine sets
  `currentTime` and **holds the video on that frame until the audio is really playing** (polled every 40 ms, given
  up after 4 s), so they start together and nothing has to catch up. Remaining drift (rarely more than a frame) is
  closed by playing ±3% faster or slower (`NUDGE`, pitch preserved, inaudible) from 0.1 s until within 0.03 s. Speed
  sets `playbackRate` with `preservesPitch`. In the track's silent tail (`END_GUARD_SECONDS`) a finished track is
  never restarted. An autoplay refusal lets the video go on silently until the next pause or seek.
- Browser voice: each scene's narration is split into sentences, one utterance each (long ones stall in Chrome),
  queued at the scene's narration start. A scene change never cancels it: if the voice is still speaking two frames
  before the scene ends (or a fast frame already crossed into the next scene), the engine **holds** there (`holding`
  in the store, shown as playing) until the last sentence ends (a watchdog releases it). Only a seek or scene jump
  interrupts speech (restarting from the sentence at that point); pause/resume and speed changes restart the current
  sentence; mute stops it without holding.
- Nothing sounds until the viewer presses play (autoplay rules). Volume and mute live in the player store, saved to
  localStorage (`algovizlib:audio`).
- `chooseVoice(hasTrack, speechAvailable)`; the controls show "Narrated by ElevenLabs" (linked) or "Browser voice",
  and the footer always shows "Voice by ElevenLabs" (free-plan attribution; no commercial license: fine for a
  portfolio).

Tests: `tests/narration-generation.test.ts` (hashing and caching, stitching runs, continuity context, billing, budget,
dry run, quota/limit handling, the ElevenLabs client, MP3 length, CLI), `tests/narration-stitch.test.ts` (trimming
never cuts speech, stitched length and offsets, the check catches a shift or lost samples, and, where ffmpeg is
installed, every committed track decoded and checked against its clips), and `tests/narration-player.test.ts` (track
timing, voice choice, the engine against a mocked audio element: one source, nothing touched at any boundary,
seeks/jumps/pause/speed/drift/stalls/autoplay, and the browser voice never cancelled at a boundary). Browser checks
(silent, see Gotchas) play every voiced video through at 1x and 2x.

## Ask about this step (the tutor)

An AI tutor beside the video answers questions about the moment on screen. It ships behind `ASK_ENABLED` (off unless
"true" or "1", and off without the provider's key), read at build time for the page (`readTutorConfig().enabled` in
the problem page) and at run time by the route.

- **Grounding.** The browser sends only `{ problemKey, sceneId, question, history }`. The server builds the context
  itself (`lib/tutor/context.ts`): the problem's title and statement, the example the video animates (the one whose
  args the trace runs on), the analogy, the scene's caption and narration, and the bound trace step with the steps
  before and after it, rerun from the trace and written with `describeStep()` (`lib/traces/describe.ts`, the same
  text the storyboard prompt lists steps with; it moved there from the prompt, which renders byte-identical). Intro and
  closing scenes have no step. Nothing about the user goes in.
- **Prompt** (`lib/tutor/prompt.ts`, `TUTOR_PROMPT_VERSION`, part of the cache key): answer only from the fenced
  CONTEXT, quote its values, say when a question goes beyond it, at most 4 sentences, stay on this problem and step,
  treat the learner's messages as questions and not instructions, never reveal the rules or the raw context. The
  question and up to 3 earlier exchanges on the same step travel as fenced user messages, never in the system prompt.
  Obvious attempts to change the instructions ("ignore previous instructions", "system prompt", "you are now…",
  "developer mode") are declined before any model call (`looksLikeInjection`) and cost no question; anything subtler
  is the model's to decline under the rules.
- **Suggestions** (`lib/tutor/suggestions.ts`, no model call), 2–3 per step, phrased as plain questions (no quoted
  labels) and built only from what the scene draws: a pointer that moved, by its on-screen label and direction ("Why
  does the arriving pointer move right?", "Why do you move right?", "Why does Friend move left?", "Why does the jogger
  move right?"; never the trace variable it binds, like `j`); the equation's own numbers ("Where does the 6 come
  from?", "Why compare 49 with 50?"); the map's lookup or new entry ("Why look for 1 in the register?"); otherwise a
  question about the structure drawn (`STRUCTURE_QUESTIONS`: "What does this call return, and why?", "Why does the
  heap reorder like this?"); then what comes next (problem-level questions for intro scenes). A test runs every
  suggestion of every scene of all 103 videos and fails on a quoted label, or on a word that's neither the questions'
  fixed wording (`SUGGESTION_WORDS`) nor in the scene's visible text (its caption and every displayed field: not ids,
  `binds`, row ids, or state switches).
- **Plain text** (`lib/tutor/plain-text.ts`): the prompt asks for no Markdown and no LaTeX, and whatever slips through
  is cleaned, as the answer streams and before it's cached: math delimiters dropped (but never prices: "$49 … $50"
  stays), `\le` → ≤, `\frac{a}{b}` → a/b, `n^2` → n², `x_1` → x₁, bold, italics, headings, and backticks removed,
  bullets as "•". The stream holds back an unclosed `$…`, `**`, or backtick until it closes, so shown text never
  changes.
- **Model:** `TUTOR_PROVIDER` (default google) and `TUTOR_MODEL` (default `gemini-3.5-flash-lite`), separate from the
  generator's `AI_PROVIDER` / `AI_MODEL`, with the provider's usual key variable. `streamText`, one attempt
  (`maxRetries: 0`), 320 output tokens, 30 s timeout. The route waits for the first chunk, so a busy provider (429, 5xx,
  timeout, dropped connection) is a 503 with a friendly message rather than an empty stream; a stream that breaks
  later ends with "(The tutor stopped early…)".
- **Access and limits** (`lib/tutor/service.ts`, dependencies injected): the flag (404), a same-origin POST (403), a
  verified sign-in (401 "Sign in to ask" / 403 verify), a question of 1–300 characters (400), a real problem and scene
  (404), then 5 questions a minute per user (`RateLimit`), the cache, and only then the daily caps: `ASK_USER_DAILY`
  (20) per user and `ASK_GLOBAL_DAILY` (450, a little under Flash-Lite's free 500 requests a day; Google shows a
  project's real limits only in AI Studio) in total. Days are Pacific days, like Google's quota: counts live in the
  `RateLimit` table keyed by user and Pacific date, with `windowStart` set to the day's end so the table's sweep never
  cuts a day short (`lib/tutor/usage.ts`). A cap's message says how long until it resets.
- **Cache:** a suggested question asked first on its step (no history) is answered once and kept in `AskCache`
  (entries older than 30 days are swept); later askers get it with no model call and no question used. Typed questions
  and follow-ups aren't cached. The cache is never fatal: a failed read or write is logged (`[tutor] answer cache read
failed …`; a missing table says to run `pnpm db:deploy`; never the question or the user) and the question is answered
  through the model like a typed one.
- **Health check** (`GET /api/health`, `lib/health.ts`): the database is reachable, every table in `REQUIRED_TABLES`
  exists, and every migration in `EXPECTED_MIGRATIONS` has run; 200 when so, 503 naming the missing tables and pending
  migrations (names only, never error text). A test keeps both lists in sync with `schema.prisma` and
  `prisma/migrations`, so a new migration must be listed. Check it after every deploy that changes the schema: a
  skipped `pnpm db:deploy` (as happened with `AskCache` on 2026-11-23) shows up there first.
- **UI** (`components/learn/ask-panel.tsx`, under the player controls, hidden in fullscreen): "Ask about this step"
  pauses the video and opens a panel with the step's label ("Step 4 of 8: $49 is too low — You move right"), the
  suggestions, and a 300-character box (Enter sends, Shift+Enter breaks a line); answers stream in, with `backticks` as
  code. The conversation is keyed by scene: another scene starts fresh; closing and reopening on the same scene keeps
  it. Esc closes and returns focus to the button; focus moves to the panel's heading on open. Guests see "Sign in to
  ask" (back to the video after sign-in).
- **Privacy and terms** describe it: questions with the problem and step go to Google's Gemini API, the free tier may
  use them to improve Google's products, no account details are sent, per-user daily counts are kept about a day, and
  answers are AI-generated and can be wrong.

Tests: `tests/tutor.test.ts` (grounding: the right step and its neighbors, exact values; suggestions; the flag and
config; access and input limits; per-user, global, and per-minute caps and the Pacific day; caching; busy and failing
providers, and the SDK adapter with `MockLanguageModelV4`; injection attempts declined with no model call, and the
question only ever fenced in user messages) and `tests/db.integration.test.ts` (daily counts, the cache, and the health check in
Postgres), and `tests/health.test.ts`. No test calls a real model.

## Try your own input

On 70 problem pages a switch above the video ("Original video" / "Your input") opens a walkthrough of the learner's
own input, built in the browser from the problem's trace: no server, no model. A problem is supported when every
argument is a number, a string, or a list of them (`lib/walkthrough/specs.ts`; the page asks `hasTryInput()` in the
repository, which reads the tiny `supported.ts` list, kept equal to the specs by a test). Trees, grids, graphs,
interval lists, matrices, and operation sequences (the other 33 traced problems) aren't supported yet.

- **Specs** (`specs.ts`, field types in `fields.ts`): each field is `numbers`, `number`, `text`, `words`, or `tokens`
  with limits at or under the trace's own `args` caps, chosen so walkthroughs fit on a phone. Parsing is forgiving
  (brackets, commas or spaces, quotes, "−") and every message ends with what the field expects ("Use 2–8 whole numbers
  between −99 and 99, separated by commas."). `rules` hold the problem's constraints with the reason ("nums must be
  sorted from smallest to largest: the approach relies on it.", "Exactly one pair…", Find the Duplicate's 1…n, a
  well-formed Decode String) and the drawing's limits in the problem's words (at most 4 brackets open at once, 3
  numbers waiting in RPN, 11 trie letter nodes, combination sum's target at most 4× the smallest candidate);
  `requirements` list them under the boxes. After the rules the trace's own `args` schema runs too. Each spec can
  draw random valid input (`random`, or each field at random until the rules hold): the "Random" button and the tests.
- **Building** (`build.ts`, `scenes.ts`): `traceScenes(trace, look)` is the test fixture's draft builder moved into
  app code (the fixture now calls it, byte-identical): one scene per key step, elements from the step's fields,
  binding values omitted so they come from the trace. The walkthrough is a "Your input" scene (the input row, or a
  card stating the input when there's no row or it won't fit), the key steps (narration = the step's note, caption =
  the note cut to 80 characters at a word), and the answer: on the last step's scene, or in a closing scene when the
  stage is full. Panel words ("in window", "till") come from the problem's original video, else plain ones
  (`PLAIN_WORDS`); item labels are positions; pointers use the trace's names, as the notes do. No analogy: the
  notes are abstract.
- **Checking** (`run.ts`, loaded with every trace and the fit checks only when "Your input" opens: `next/dynamic` in
  `video-section.tsx`): parse → rules → trace `args` → run → build → `storyboardSourceSchema` → `resolveStoryboard` →
  `validateStoryboard` → `sceneFitProblems` on every scene. A scene that fails is simplified a level at a time
  (`SceneLook.level`: 1 drops the equation and answer card, 2 pointers and callouts, 3 side panels, 4 the input row;
  never emptied) and the whole pipeline reruns. Anything still failing is refused with "This input makes a
  walkthrough too big to show clearly on a small screen…" (details go to `console.warn`). Nothing unchecked reaches
  the player.
- **UI** (`try-input-panel.tsx`): boxes prefilled with the video's example, hints under each, the requirements,
  "Show walkthrough", "Reset to example", "Random", "Back to the video", and over the player "Your input" with the
  input and "Copy link". The shown input lives in the address bar (`?input=`, base64url JSON, `encodeInput`), so the
  page's URL is the share link; a link is decoded (shape only: `decodeInput`), put in the boxes, and checked like typed
  input; a bad one falls back to the example with a note. Going back to the original video drops `?input=`. Only one
  player is mounted at a time (they share the player store).
- **No progress, no tutor.** The walkthrough's `LearnView` gets `walkthroughViewProps()`: no `problemKey` (so no
  "Learning", saved position, resume, or "Mark as done?") and no tutor (it only knows committed videos; a follow-up).
  Browser voice only (no stitched track). Nothing is stored or sent anywhere.
- **Tests** (`tests/walkthrough.test.ts`): the 70 specs and the supported list; per problem, the video's example
  round-trips through the boxes and builds, and 8 seeded random inputs (`WALKTHROUGH_RANDOM=150` for a stress run)
  parse back to themselves, give the reference solution's answer (by the problem's judge), and build a walkthrough
  that validates, fits at phone width, has short captions, no track, and no empty scene; share links round-trip and
  tampered ones are refused; refusal messages for each kind of field and rule; a too-big input is refused with the
  plain message; the walkthrough player has no problem key or tutor.
- Running every trace on arbitrary input found and fixed: House Robber crashed when the first house held $0; Cycle II
  and Find the Duplicate's restart equation claimed head → start = meet → start, which holds only when fast lapped
  slow once (it's now `meet + laps × loop = head` when they differ); Circular Array Loop's moves refused at once (0
  hops) failed the schema (now allowed, drawn as just the ✕); Combination Sum with no answer had an empty answer
  ("none" now); Permutations said "1 orderings"; the bits panel's digits had no React keys.

## Quick checks

Before some key steps the video pauses and asks a short multiple-choice question about what the step is about to do.
No model: questions come from the trace, so the right answer is the algorithm's own.

- **Building** (`lib/quickcheck/build.ts`, `buildQuickChecks(storyboard, trace)`): a scene bound to a key step, after
  another scene, gets one question from the first kind that fits: a design call's output ("What does get(1)
  return?"), a greedy choice ("Which does it choose?" between the step's chosen and rejected options), a comparison in
  the video's own verdict words ("4 + 45 vs 50: what happens next?" too low / exact! / too high; only verdicts used for
  one comparison result across the video, none with a number in it), a plain comparison (less than / equal to /
  greater than), a map lookup ("Is 6 already in the map?", only when the trace's `found` means "stored before"), a heap
  pop (the nearest keys still in the heap as wrong options), a DP cell (the cells it reads and ±1), a call's return
  value, a union-find "same group?", a trie insert's new nodes, a stack pop count, the queue's next, a race round
  ("Do the jogger and the sprinter land together this round?", full rounds only), a link rewire ("Where does 7 point
  next?"), a backtracking step ("Next choice: +4. What happens?" go deeper / record an answer / cut the branch), a trie
  child ("Is there already a node for r under a?"), and last which pointer moves. At most three per video, spread
  evenly. Names are the ones drawn (pointer labels through the tutor's `pointerSubject`), values are on screen; a
  test checks every word against the two scenes' visible text plus the questions' fixed wording (numeric options and
  verdict words, shown elsewhere in the video, aside). 89 of the 103 videos get questions (220 in all); the other 14
  (bit panels, BFS grids, Kahn's graphs, N-Queens, sorts whose comparisons all go one way…) get none rather than a
  forced one, and a test pins the list.
- **Validating** (`validate.ts`, `validateQuickChecks`): `claim` holds what each kind needs, and the validator works
  out from the trace alone whether each option is true (the arithmetic and its sign, the pointer index that changed,
  the key in the previous step's map, the cell's value, the heap's extreme over what it held, the stack's sizes, the
  queue's front, roots before the union…), requiring the marked answer to be the only true option. It also checks the
  scene, step, explanation (the step's note), and at most three per video. Committed videos are built on the server
  (`for-problem.ts`, server-only, so no trace code ships) and passed to the page; walkthroughs build theirs in the lazy
  chunk. A question that doesn't validate is never shown.
- **Playing** (`use-quick-checks.ts`, `schedule.ts`): a check pauses on the last frame before its scene's cross-fade
  (`sequenceStart − 1`: the scene before is fully drawn and nothing of the answer is), only when playback reaches it
  on its own (`dueCheck`: playing, forward, at most `MAX_PLAY_STEP` frames since the last update; a seek, scene jump,
  or resume past it never asks), once per viewing, and only with "Quick checks: on" (the setting under the controls,
  on by default, `algovizlib:quick-checks`). The player store's `checking` holds the player's shortcuts. The card
  (`quick-check.tsx`) sits under the controls inside the player card (so it's there in fullscreen), the stage dims,
  it scrolls into view on a phone, and focus moves to the first option: 1–n answer, arrows move, Enter answers the
  focused option, S or Esc skips. The answer shows ✓ / ✕, the right option, and the step's note, then Continue
  (focused; Enter) plays on. Pressing play while it's open skips it. Narration uses the player's own pause and play.
  At the end, "quick checks 2 of 3 correct" (this viewing's answers; skips don't count).
- **Results** (`results.ts`, `server.ts`, `/api/checks`): an answer is `{ id, problemKey, questionId, sceneId, step,
correct, source, input?, answeredAt }` (`source: "walkthrough"` with the input as in the share link, so it never
  counts as the problem's video). Guests and unverified accounts keep them in `algovizlib:checks:v1` (at most 2,000).
  A verified account's answers are kept as pending, POSTed in batches of up to 100, and dropped from the browser once
  saved; signing in as a verified user sends everything the browser kept (`checkRecorder.setAccount`, from
  `AccountProvider`). The server keys rows by user and id with `skipDuplicates`, so retries and merges keep every
  answer once; unknown problems are dropped and future times clamped. A missing table (P2021: the migration hasn't
  run) or any database error is a 503 and a log line ("the CheckResult table is missing: run `pnpm db:deploy`"); the
  browser keeps the answers pending and sends them later. Answers never change Learning or Done.
- Tests: `tests/quickcheck.test.ts` (every video's questions validate, the 14 without are pinned, every word is on
  screen, mutated questions fail, and 4 random inputs for each of the 70 walkthrough problems), `tests/quickcheck-play.test.ts`
  (pause frames and natural crossing, keys, the summary, the setting, the recorder (guest, merge on
  sign-in, pending through a failure, broken storage), no progress imports, and the API's access, validation,
  clamping, rate limit, and 503s), `tests/db.integration.test.ts` (stored once per user, newest first, cascade; a
  missing table is a 503), and `tests/health.test.ts`.

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
hand of playing cards (insertion), tallying star ratings (counting), merging stacks of marked quizzes (merge), a
librarian shelving a series around one volume (quick), an org chart whose top person retires (heap), and two
friends' movie rankings (Count Inversions). Sliding Window: a taco truck's best 3 days (Maximum Sum Subarray), a DJ's
repeat-free run of songs (Longest Substring), repainting one fence board (Character Replacement), the shortest walk
past market stalls that sell everything on a list (Minimum Window), and the highest UV index in each 3-day forecast
stretch (Sliding Window Maximum). Binary Search: a hotel directory with basement floors (Search a Sorted Array), a new
bus slotted into a timetable (Search Insert Position), a community board of event dates that wraps into next month
(Rotated), and two classes' sorted quiz scores (Median); Koko Eating Bananas is problem-native. Linked List: a
scavenger hunt rerun backwards (Reverse), two boarding queues merging at one gate (Merge Two), a parade spotter walking
a fixed two floats ahead (Remove Nth), a slideshow alternating oldest and newest photos (Reorder), and one departure
board for three subway lines (Merge K). Trees (DFS): a cave's deepest route, reported back chamber by chamber (Maximum
Depth), a hike of exactly 13 km from a trailhead to a campsite (Path Sum), mail routing desks whose unit numbers must fit
every turn above them (Validate BST), record-height stations on a cable car network (Count Good Nodes), and the most
profitable stretch of road between towns that earn or cost money (Maximum Path Sum). Graphs (BFS): Flood Fill,
Number of Islands, and Rotting Oranges are problem-native (a paint bucket, a map, a crate); Shortest Path in a Binary
Matrix is a chess king crossing a board with blocked squares, and Word Ladder a locksmith recutting a key one notch at
a time, every key on the building's register. Heap / Priority Queue: Last Stone Weight is problem-native; Kth Largest
is a talent-show judge's two-seat shortlist, Top K Frequent a record shop's two-slot display, K Closest Points the two
lockers nearest a courier depot, and Find Median a party host splitting arriving children into a younger and an older
group. Dynamic Programming: Climbing Stairs, House Robber, and Coin Change are problem-native (the staircase, the
street, the cashier, with their own numbers); Longest Common Subsequence is two bird-watchers' sighting logs, and Edit
Distance a sign painter turning CART into ACT. Stack: Daily Temperatures is problem-native (the forecast); Valid
Parentheses is a packer shutting nested boxes with matching lids, Evaluate RPN a diner's order spike, Decode String a
knitting pattern's repeat brackets, and Largest Rectangle the widest banner across a row of rooftops. Backtracking:
N-Queens is problem-native (the board); Subset XOR Totals is a painter's tint pots whose codes XOR, Subsets packing a
picnic basket, Permutations a relay team's running orders, and Combination Sum filling a 12-litre tank with 4 L and 6 L
jugs. Arrays & Hashing: Two Sum is a puzzle-swap host's register of who has arrived, Valid Anagram two Scrabble
racks and one tally, Group Anagrams magnetic-letter words on trays labeled by their letters, Longest Consecutive
Sequence runs of taken parking spots, and First Missing Positive keys put back in their own numbered lockers. Fast & Slow Pointers: a jogger and a sprinter on a route that may loop (Cycle), a walker and a hopper on stepping
stones (Middle), a hiker and a runner on a looping trail, then a restart from the trailhead (Cycle II), gallery rooms
whose exit signs name the next room (Find the Duplicate), and a frog and a toad on painted stones around a pond
(Circular Array Loop). Greedy: Lemonade Change, Gas Station, Candy, and Jump Game are problem-native (the stand's till,
the fuel stops, the children's ratings, the squares and their jump lengths); Partition Labels is a porter loading
carousel bags onto as many carts as possible, each family's bags on one cart. Prefix Sum: a shelf of jars balancing on
one bracket (Find Pivot Index), a hiker's altimeter read at each camp (Range Sum Queries), runs of days in a café's
profit ledger (Subarray Sum Equals K), outfits when one kind of clothing stays home (Product of Array Except Self), and
blocks of orchard plots holding exactly 3 crates (Number of Submatrices That Sum to Target). Intervals: Meeting Rooms
is problem-native (the calendar); Merge Intervals is crews booking a site's one crane, Insert Interval a new lane closure
in a road crew's schedule, Non-overlapping Intervals cancelling the fewest workshops in one studio, and Minimum Interval
to Include Each Query parcels going to the shortest driver shift that covers their hour. Bit Manipulation: a panel of
light switches each ticket flips (Single Number), a lamp scoreboard counting lit lamps (Counting Bits), a gym scanner
where every member scans three times but one guest (Single Number II), a counting board with no "+" key (Sum of Two
Integers), and a night guard checking every room of a gallery with a lamp per room checked (Shortest Path Visiting All
Nodes). Trie: Word Search II is problem-native (the board); Longest Common Prefix is boats sailing a river delta until
it first splits, Implement Trie a mailroom's cubbies (one letter per level, a flag where a name ends), Design Add and
Search Words a crossword helper's blank squares, and Replace Words a stenographer's shorthand stems. Advanced Graphs: Course
Schedule, Network Delay Time, and Alien Dictionary are problem-native (the courses and prerequisites, the servers and
links, the alien word list); Find if Path Exists is villages joining clans under chiefs as roads are built, and
Redundant Connection a crew wiring substations, each reporting to a hub, where the spare cable joins two that already
share one. Data Structure Design: LRU Cache, LFU Cache, and Time Based Key-Value Store are problem-native (the caches
and the store, with their own calls; TimeMap's first example sets one key at times 1, 4, 7, 9 and gets at 6, 0, and 12,
so a search is two or three probes deep); Min Stack is a stack of pancakes, each with a sticky note giving the smallest
size at or below it, and Implement Queue using Stacks a deli's in and out ticket
trays (new tickets go on the in tray; when the out tray is empty the in pile is flipped onto it, so the oldest ticket
is on top).

The UI shows a badge: "Real-world problem" (problem-native) or "Explained with an analogy".

## UI conventions

- **Look: a black-and-orange ("fiery") developer tool.** Warm near-black backgrounds (never pure `#000`) and charcoal
  surfaces in dark mode, warm off-white in light; thin borders, generous whitespace, monospace metadata, no gradients
  or emoji. One accent: **orange** (`--primary`/`--ring` in `globals.css`, `primary`/`active` in `video/theme.ts`) for
  buttons, links, active states, focus rings, progress bars, the active scene, and the videos' pointers, brackets, and
  "mid" markers. Light mode uses a darker burnt orange so orange text passes 4.5:1. A soft glow (`--glow`) is allowed
  on key accents only (hover/focus boxes, the active scene). Don't add a second hue.
- **Keep meaning colors away from the accent.** Verdicts: green (good news), sky (information), and **rose/crimson**
  for bad news (`danger` in the video palette, `--destructive` in the UI), never red-orange, always next to a glyph or
  a word. Secondary video pointers are neutral (stone), not orange. Difficulty badges are neutral (no color at all).
- **Hover and keyboard focus box:** interactive cards and rows (category, pattern, problem rows and mobile cards,
  previous/next) carry `glow-box`: a 1px orange outline plus soft glow on hover, and the same box when the card or any
  link inside it has keyboard focus (the inner link's own ring is dropped). 150ms transition, off under reduced motion.
  Command palette results get the same box when selected (hover or arrow keys).
- **Type:** Geist Sans for prose; Geist Mono for labels, metadata, breadcrumbs (`dsa / two-pointers / …`),
  complexity, examples, and shortcut hints (`<Kbd>`). Section labels are lowercase mono (`core idea`, `examples`).
- **Difficulty** is a muted badge: the word plus a 1–3 bar meter, never color alone. **Status** is a glyph plus a word
  (○ Not started, ◐ Learning, ● Done).
- Render content strings with `<InlineText>` / `<RichText>` (`components/catalog/rich-text.tsx`) so `backticks`
  become code. Content never contains HTML.
- Tables become stacked cards below `md`. Visible focus rings everywhere (`:focus-visible` in `globals.css`). A
  region that scrolls sideways (the design problems' operation tables) is focusable with a unique `aria-label`.
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
  5s, Shift+←/→ previous/next scene, F fullscreen, M mute narration.
- Respect `prefers-reduced-motion` in both the UI (`motion-reduce:` plus the global CSS rule) and the video
  (`reducedMotion` input prop).

## Roadmap

1. **More generated videos.** Offline generation exists (above) and every catalog problem has a video. Next: runtime
   generation for custom questions behind a server route with rate limits, reusing the same pipeline and validator
   (the tutor's route, limits, and cache are the pattern to follow).
2. **Narration.** Built (see "Narration"); every video is voiced; voice new ones with `--missing` as the monthly free quota allows. Later, use
   ElevenLabs' word timestamps (`/with-timestamps`) to time callouts and equations, and highlight words in the
   transcript.
3. **Database and custom questions.** Accounts and server-backed progress are built (see "Accounts"). Next: move
   the catalog and storyboards behind the repository into the database, and let users paste their own question.
   Email + password in production once a Resend sending domain is verified.
4. **Practice mode.** See "Practice mode (planned)" above.
5. **System design explainers.** `box-arrow` primitive (services, queues, caches, arrows with animated requests),
   plus traces/validators for things like consistent hashing, rate limiters, and load balancing.
6. **Rate limiting.** Auth and progress are limited (Postgres counters, `lib/auth/rate-limit.ts`); reuse them for
   generation and narration endpoints (both cost money), plus caching identical requests.
7. Planned DSA primitives: `coin-set` (Coin Change uses an item-row today), with its trace.
8. **Quick checks**, next: a review queue from the stored answers (`GET /api/checks`), and questions for the 14
   videos without (bit panels, grids, graphs).
9. **Try your own input**, next: the tutor for walkthroughs (its context would be the learner's input and the
   rerun trace, not a committed video's scene), and inputs for trees, grids, graphs, and intervals (each needs an
   editor that isn't a text box).

## Gotchas

- **Prisma 7** generates its client into `src/generated/prisma` (gitignored) with the `prisma-client` generator and
  the `pg` driver adapter (`lib/db.ts`: plain TCP to Neon's pooled URL from Node functions; `@prisma/adapter-neon` is
  only needed on the Edge runtime). **`pnpm build` runs `prisma generate` itself**: `postinstall` alone isn't
  enough, because when Vercel restores `node_modules` from its build cache and the lockfile is unchanged, pnpm skips
  every install script (that's why deploy 4a6ad59 failed with "Can't resolve '@/generated/prisma/client'"). Generating
  needs no database, so builds without `DATABASE_URL` (previews) work. Import from `@/generated/prisma/client`.
  `prisma.config.ts` loads `.env.local` (the CLI doesn't). Prisma's install scripts are allowed in
  `pnpm-workspace.yaml` (`allowBuilds`). Auth.js and Prisma packages are pinned to exact versions.
- **Auth forms submit through `startTransition`, not `<form action>`** (`useFieldValidation().submitWith`): React
  resets a form's fields after a `<form action>` completes, which cleared the email after a wrong password and the
  confirm field after a server error. Sign-in, sign-out, and change-password end with a full page load
  (`window.location.assign`) so the session in the header refreshes.

- **Automated browser checks must be silent.** Launch Chrome and create contexts only through
  `scripts/browser-checks/silent.mjs` (`launchSilent(chromium)`, `silentContext(browser, options)`). It passes
  `--mute-audio` (ElevenLabs `<audio>` still plays, so `currentTime`, `paused`, `playbackRate`, and volume checks
  work) and replaces `speechSynthesis` / `SpeechSynthesisUtterance` with a silent fake, because the browser voice
  goes through macOS speech, which ignores the flag. The fake fires start, word boundary, end, and cancel errors at
  about 150 wpm times the rate, so the engine's sentence sync and scene holds behave as with a real voice.

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
