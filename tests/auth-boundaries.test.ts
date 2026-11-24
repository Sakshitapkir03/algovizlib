import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Secrets and server code never reach the browser: client components may call server actions
 * (`@/lib/auth/actions`, which run on the server), but never import the database, Auth.js config, password
 * hashing, tokens, email, or the progress API's server side.
 */
const SERVER_ONLY = [
  "@/auth",
  "@/lib/db",
  "@/generated/",
  "@/lib/auth/deps",
  "@/lib/auth/password",
  "@/lib/auth/store",
  "@/lib/auth/service",
  "@/lib/auth/mailer",
  "@/lib/auth/tokens",
  "@/lib/progress/server",
  "@/lib/progress/api-deps",
  "@/lib/tutor/model",
  "@/lib/tutor/deps",
  "@/lib/tutor/service",
  "@/lib/tutor/usage",
  "@/lib/quickcheck/server",
  "@/lib/quickcheck/api-deps",
  "@/lib/quickcheck/for-problem",
  "@/lib/review/server",
  "@/lib/review/api-deps",
];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (file.includes(`${path.sep}generated`)) continue;
    if (statSync(file).isDirectory()) sources(file, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(file);
  }
  return out;
}

const src = path.join(process.cwd(), "src");
const files = sources(src).map((file) => ({
  file: path.relative(src, file),
  text: readFileSync(file, "utf8"),
}));

describe("server code stays on the server", () => {
  it("no client component imports server-only modules", () => {
    const offenders = files
      .filter((f) => /^["']use client["']/m.test(f.text))
      .flatMap((f) =>
        [...f.text.matchAll(/from ["']([^"']+)["']/g)]
          .map((m) => m[1])
          .filter((spec) =>
            SERVER_ONLY.some((s) => spec === s || spec.startsWith(s.endsWith("/") ? s : `${s}/`)),
          )
          .map((spec) => `${f.file} → ${spec}`),
      );
    expect(offenders).toEqual([]);
  });

  it("modules holding secrets or the database are marked server-only (a client import fails the build)", () => {
    for (const file of [
      "auth.ts",
      "lib/db.ts",
      "lib/auth/deps.ts",
      "lib/auth/password.ts",
      "lib/progress/api-deps.ts",
      "lib/tutor/model.ts",
      "lib/tutor/deps.ts",
      "lib/quickcheck/api-deps.ts",
      "lib/quickcheck/for-problem.ts",
      "lib/review/api-deps.ts",
    ])
      expect(readFileSync(path.join(src, file), "utf8"), file).toMatch(/^import "server-only";/m);
  });

  it("no secret is exposed through a NEXT_PUBLIC_ variable", () => {
    expect(files.filter((f) => f.text.includes("NEXT_PUBLIC_")).map((f) => f.file)).toEqual([]);
  });

  it("server actions authorize themselves from the session, never from an id in the form", () => {
    const actions = readFileSync(path.join(src, "lib/auth/actions.ts"), "utf8");
    expect(actions).toMatch(/^"use server";/);
    expect(actions).not.toMatch(/form\.get\(["']userId["']\)/);
    for (const name of ["resendVerificationAction", "changePasswordAction"]) {
      const body = actions.slice(actions.indexOf(`function ${name}`));
      expect(body.slice(0, 300)).toContain("await auth()");
    }
  });
});
