import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";

/**
 * The link-preview card (Open Graph / Twitter, 1200×630) for the home, pattern, and problem pages: the site's dark
 * palette (warm near-black, one orange accent), Geist for the title and Geist Mono for metadata, like the pages.
 * Rendered at build time (every route that uses it is static), so the fonts are read from `assets/fonts`.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The video palette's dark theme (src/video/theme.ts), so the card matches the player.
const C = {
  background: "#0f0d0c",
  surface: "#1a1715",
  border: "#3d3733",
  text: "#f6f4f2",
  muted: "#a8a29e",
  primary: "#f97316",
};

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

export type OgCard = {
  /** Mono path above the title, e.g. "dsa / two-pointers". */
  eyebrow: string;
  title: string;
  /** One line under the title, e.g. "Two Pointers · Easy". */
  subtitle: string;
  /** Short mono facts along the bottom, e.g. ["animated video", "3 hints"]. */
  facts: string[];
};

/** A row of cards with two pointers closing in: the site's first video, as a small mark in the corner. */
function Mark() {
  const values = [3, 8, 12, 19, 27, 31];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {values.map((v, i) => (
          <div
            key={v}
            style={{
              display: "flex",
              width: 52,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              border: `2px solid ${i === 1 || i === 4 ? C.primary : C.border}`,
              background: C.surface,
              color: C.text,
              fontFamily: "Geist Mono",
              fontSize: 22,
            }}
          >
            {v}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {values.map((v, i) => (
          <div
            key={v}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 52,
              gap: 4,
              color: C.primary,
              fontSize: 20,
              fontFamily: "Geist Mono",
            }}
          >
            {(i === 1 || i === 4) && (
              <svg width="18" height="14" viewBox="0 0 18 14">
                <polygon points="9,0 18,14 0,14" fill={C.primary} />
              </svg>
            )}
            {(i === 1 || i === 4) && <span>{i === 1 ? "L" : "R"}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The card as a PNG response. The bytes are rendered in a cached function (catalog content only changes with a
 * deploy), which lets Cache Components prerender every card at build time instead of rendering on each request.
 */
export async function ogImage(card: OgCard): Promise<Response> {
  const png = await renderCard(card);
  return new Response(new Blob([new Uint8Array(png)]), {
    headers: { "Content-Type": OG_CONTENT_TYPE, "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}

async function renderCard({ eyebrow, title, subtitle, facts }: OgCard): Promise<Uint8Array> {
  "use cache";
  cacheLife("max");
  const [semibold, regular, mono] = await Promise.all([
    font("Geist-SemiBold.ttf"),
    font("Geist-Regular.ttf"),
    font("GeistMono-Regular.ttf"),
  ]);
  const titleSize = title.length > 34 ? 64 : 76;
  const image = new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "56px 72px",
        background: C.background,
        color: C.text,
        fontFamily: "Geist",
        borderTop: `8px solid ${C.primary}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 30 }}>
          <span style={{ color: C.primary }}>{">_"}</span>
          <span style={{ marginLeft: 14 }}>algovizlib</span>
        </div>
        <Mark />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 26, color: C.muted }}>
          <span style={{ color: C.primary, marginRight: 14 }}>$</span>
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: titleSize,
            fontWeight: 600,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: C.muted }}>{subtitle}</div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 44,
          paddingTop: 24,
          borderTop: `1px solid ${C.border}`,
          fontFamily: "Geist Mono",
          fontSize: 22,
          color: C.muted,
        }}
      >
        {facts.map((fact, i) => (
          <span key={fact} style={{ display: "flex" }}>
            {i > 0 && <span style={{ margin: "0 16px", color: C.border }}>·</span>}
            {fact}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: C.text }}>algovizlib.vercel.app</span>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
  return new Uint8Array(await image.arrayBuffer());
}
