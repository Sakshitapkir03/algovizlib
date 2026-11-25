/**
 * Print the exact instructions the generator would send for a problem or a system design lesson (system + user
 * prompt), so a person or Claude Code can author the draft by hand. Usage: pnpm storyboards:prompt <key>
 */
import path from "node:path";

import { createCatalogAccess, findTarget } from "@/lib/generation/catalog-access";
import { prepareLesson } from "@/lib/generation/lesson";
import { prepareTarget } from "@/lib/generation/pipeline";
import { currentPrompts } from "@/lib/generation/prompts";
import { createFileWriter } from "@/lib/generation/writer";

const key = process.argv[2];
const writer = createFileWriter(path.join(process.cwd(), "src/content/storyboards/generated"));
const lesson = key ? prepareLesson(key, writer) : undefined;
const target = key && !lesson ? findTarget(createCatalogAccess(writer), key) : undefined;
const prepared = target && prepareTarget(target, currentPrompts.version);
if (lesson) {
  console.log(
    `<!-- prompt ${lesson.prompts.version} for ${key}: write the JSON to .cache/drafts/${key}.json -->`,
  );
  console.log(
    `\n# SYSTEM\n\n${lesson.prompts.systemPrompt()}\n\n# USER\n\n${lesson.prompts.generatePrompt(lesson.promptInput)}`,
  );
} else if (!prepared) {
  console.error(
    `Usage: pnpm storyboards:prompt <key> (a catalog problem or system design lesson with a trace)`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `<!-- prompt ${currentPrompts.version} for ${key}: write the JSON to .cache/drafts/${key}.json -->`,
  );
  console.log(
    `\n# SYSTEM\n\n${currentPrompts.systemPrompt()}\n\n# USER\n\n${currentPrompts.generatePrompt(prepared.promptInput)}`,
  );
}
