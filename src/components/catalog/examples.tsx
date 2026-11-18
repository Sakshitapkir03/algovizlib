import type { ProblemExample } from "@/lib/catalog";

import { InlineText } from "./rich-text";

/** Examples as code-style blocks: input, output, and an optional explanation. */
export function Examples({ examples }: { examples: ProblemExample[] }) {
  return (
    <ol className="space-y-3">
      {examples.map((example, i) => (
        <li key={i}>
          <p className="mb-1.5 text-sm font-medium">Example {i + 1}</p>
          <div className="overflow-x-auto rounded-lg border bg-muted/40 px-4 py-3 font-mono text-[13px] leading-6">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3">
              <dt className="text-muted-foreground">input</dt>
              <dd className="whitespace-pre-wrap">{example.input}</dd>
              <dt className="text-muted-foreground">output</dt>
              <dd className="whitespace-pre-wrap">{example.output}</dd>
            </dl>
          </div>
          {example.explanation && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              <InlineText text={example.explanation} />
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
