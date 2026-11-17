import { Film, Lightbulb, ShieldCheck } from "lucide-react";

import { ProblemCard } from "@/components/site/problem-card";
import { storyboards } from "@/content/storyboards";

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Approach first",
    body: "Each video builds intuition for why the approach works, not a line-by-line walkthrough of the code.",
  },
  {
    icon: Film,
    title: "Real-world examples",
    body: "Problems that are already real-world stories keep their own scenario. Abstract ones get a relatable analogy.",
  },
  {
    icon: ShieldCheck,
    title: "Verified steps",
    body: "Every pointer move and equation is checked against a deterministic algorithm engine.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-14 sm:py-20" aria-labelledby="hero-heading">
        <p className="text-sm font-medium text-primary">Algorithms & system design, visualized</p>
        <h1
          id="hero-heading"
          className="mt-2 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl"
        >
          Understand the idea behind the algorithm in two minutes.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
          algovizlib turns computer science concepts into short animated videos. Each one follows a concrete,
          real-world example from the problem to the pattern you can reuse.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border p-4">
              <Icon aria-hidden className="size-5 text-primary" />
              <p className="mt-2 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="pb-20" aria-labelledby="library-heading">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="library-heading" className="text-xl font-semibold tracking-tight">
            Problem library
          </h2>
          <p className="text-sm text-muted-foreground">
            {storyboards.length} {storyboards.length === 1 ? "video" : "videos"}
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storyboards.map((sb) => (
            <li key={sb.id}>
              <ProblemCard storyboard={sb} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
