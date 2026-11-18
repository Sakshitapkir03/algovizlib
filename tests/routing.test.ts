import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import { loadPattern, loadProblem } from "@/app/dsa/load";
import { getProblem } from "@/lib/catalog/repository";

/** What Next's notFound() throws: an error whose digest marks a 404. */
function expectNotFound(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect((error as { digest?: string }).digest).toMatch(/404/);
    return;
  }
  throw new Error("expected notFound() to be thrown");
}

describe("redirects", () => {
  it("permanently redirects /learn/two-pointers to its problem page", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    const legacy = redirects.find((r) => r.source === "/learn/two-pointers");
    expect(legacy).toMatchObject({ destination: "/dsa/two-pointers/pair-with-target-sum", permanent: true });
  });

  it("every /learn/<id> redirect lands on the problem that hosts that storyboard", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const r of redirects.filter((r) => r.source.startsWith("/learn/"))) {
      const [, , patternSlug, slug] = r.destination.split("/");
      const problem = getProblem(patternSlug, slug);
      expect(problem, r.destination).toBeDefined();
      expect(problem?.storyboardId).toBe(r.source.replace("/learn/", ""));
    }
  });
});

describe("unknown slugs 404", () => {
  it("resolves known pattern and problem slugs", () => {
    expect(loadPattern("two-pointers").name).toBe("Two Pointers");
    expect(loadProblem("two-pointers", "pair-with-target-sum").problem.title).toBe("Pair with Target Sum");
  });

  it("404s an unknown pattern", () => {
    expectNotFound(() => loadPattern("not-a-pattern"));
  });

  it("404s an unknown problem, and a real problem under the wrong pattern", () => {
    expectNotFound(() => loadProblem("two-pointers", "not-a-problem"));
    expectNotFound(() => loadProblem("not-a-pattern", "pair-with-target-sum"));
    expectNotFound(() => loadProblem("sliding-window", "pair-with-target-sum"));
  });
});
