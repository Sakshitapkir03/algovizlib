import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Generation code (AI SDK, API keys, file writes) runs only in scripts/ and tests. Never in the app bundle.
    // The tutor (src/lib/tutor, server-only) is the one runtime use of the AI SDK; it still can't import the generator.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/generation/**", "src/lib/tutor/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/generation", "@/lib/generation/*", "**/lib/generation/*", "ai", "@ai-sdk/*"],
              message: "Storyboard generation is offline tooling (scripts/). Don't import it from app code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/tutor/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/generation", "@/lib/generation/*", "**/lib/generation/*"],
              message: "The tutor runs in the app: it can't use the offline storyboard generator.",
            },
          ],
        },
      ],
    },
  },
  // .claude/worktrees: Claude Code worktrees, each a full checkout of the repo.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    ".claude/worktrees/**",
    // Gitignored scratch space (generation cache, drafts, local check scripts).
    ".cache/**",
  ]),
]);

export default eslintConfig;
