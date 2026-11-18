/**
 * Permanent redirects for URLs that existed before the catalog. Imported by next.config.ts, so this file must not
 * import anything (the config loader doesn't resolve `@/` aliases). tests/routing.test.ts checks that each
 * `/learn/<storyboardId>` lands on the problem page that hosts that storyboard.
 */
export const legacyRedirects = [
  { source: "/learn/two-pointers", destination: "/dsa/two-pointers/pair-with-target-sum", permanent: true },
] as const;
