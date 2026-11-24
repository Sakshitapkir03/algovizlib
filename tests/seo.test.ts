import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageMetadata, SOCIAL_DESCRIPTION_MAX, socialDescription } from "@/lib/seo";

describe("link previews", () => {
  it("a page's metadata carries its title, description, canonical URL, Open Graph, and a large Twitter card", () => {
    const m = pageMetadata({ title: "Three Sum", description: "d", path: "/dsa/two-pointers/three-sum" });
    expect(m.title).toBe("Three Sum");
    expect(m.alternates?.canonical).toBe("/dsa/two-pointers/three-sum");
    expect(m.openGraph).toMatchObject({
      title: "Three Sum · algovizlib",
      description: "d",
      url: "/dsa/two-pointers/three-sum",
      siteName: "algovizlib",
      type: "website",
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "Three Sum · algovizlib" });
  });

  it("the home page keeps its title as is", () => {
    const m = pageMetadata({ title: "algovizlib: x", description: "d", path: "/", absoluteTitle: true });
    expect(m.title).toEqual({ absolute: "algovizlib: x" });
    expect(m.openGraph?.title).toBe("algovizlib: x");
  });

  it("the home, pattern, and problem routes each have a preview image, and its fonts are committed", () => {
    for (const file of [
      "src/app/opengraph-image.tsx",
      "src/app/dsa/[pattern]/opengraph-image.tsx",
      "src/app/dsa/[pattern]/[problem]/opengraph-image.tsx",
      "assets/fonts/Geist-SemiBold.ttf",
      "assets/fonts/Geist-Regular.ttf",
      "assets/fonts/GeistMono-Regular.ttf",
      "assets/fonts/OFL.txt",
    ])
      expect(existsSync(file), file).toBe(true);
  });

  it("previews get a description short enough not to be cut off; search keeps the whole one", () => {
    const long =
      "Walk two indexes through a sequence, usually from both ends toward the middle, so each comparison rules out a whole group of candidates instead of one.";
    const short = socialDescription(long);
    expect(short.length).toBeLessThanOrEqual(SOCIAL_DESCRIPTION_MAX);
    expect(short).toBe(
      "Walk two indexes through a sequence, usually from both ends toward the middle, so each comparison rules out a whole group…",
    );
    const m = pageMetadata({ title: "Two Pointers", description: long, path: "/dsa/two-pointers" });
    expect(m.description).toBe(long);
    expect(m.openGraph?.description).toBe(short);
    expect(m.twitter?.description).toBe(short);
    expect(socialDescription("Short.")).toBe("Short.");
  });
});
