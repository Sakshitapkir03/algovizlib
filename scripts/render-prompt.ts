/**
 * Print the exact instructions the generator would send for a problem (system + user prompt), so a person or Claude
 * Code can author the draft by hand. Usage: pnpm storyboards:prompt <pattern>/<slug>
 */
import path from "node:path";

import { createCatalogAccess, findTarget } from "@/lib/generation/catalog-access";
import { prepareTarget } from "@/lib/generation/pipeline";
import { currentPrompts } from "@/lib/generation/prompts";
import { createFileWriter } from "@/lib/generation/writer";

const problem = process.argv[2];
const writer = createFileWriter(path.join(process.cwd(), "src/content/storyboards/generated"));
const target = problem ? findTarget(createCatalogAccess(writer), problem) : undefined;
const prepared = target && prepareTarget(target, currentPrompts.version);
if (!prepared) {
  console.error(`Usage: pnpm storyboards:prompt <pattern>/<slug> (a catalog problem with a trace)`);
  process.exitCode = 1;
} else {
  console.log(
    `<!-- prompt ${currentPrompts.version} for ${problem}: write the JSON to .cache/drafts/${problem}.json -->`,
  );
  console.log(
    `\n# SYSTEM\n\n${currentPrompts.systemPrompt()}\n\n# USER\n\n${currentPrompts.generatePrompt(prepared.promptInput)}`,
  );
}
