import type { Metadata } from "next";

/**
 * Absolute URLs for link previews (Open Graph, Twitter cards, canonical links), baked into the prerendered pages at
 * build time: `APP_URL`, else Vercel's production domain, else the live site (so a local or preview build never
 * points canonical links or preview images at localhost).
 */
export const SITE_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://algovizlib.vercel.app");

export const SITE_NAME = "algovizlib";

/**
 * A page's title, description, canonical URL, and the matching Open Graph and Twitter fields. The preview image comes
 * from the route's `opengraph-image` (X falls back to `og:image`, so there's no separate `twitter-image`).
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** The home page: the title is used as is, not with the " · algovizlib" template. */
  absoluteTitle?: boolean;
}): Metadata {
  const social = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title: social,
      description,
    },
    twitter: { card: "summary_large_image", title: social, description },
  };
}
