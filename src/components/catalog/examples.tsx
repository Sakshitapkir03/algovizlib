import type { Problem, ProblemExample } from "@/lib/catalog";

import { InlineText } from "./rich-text";

type Json = ProblemExample["expected"];

const show = (value: Json) => JSON.stringify(value).replaceAll(",", ", ").replaceAll(":", ": ");

/**
 * An "operations" example (`args = [operations, arguments]`) as rows of call → output. The first operation is the
 * constructor; `null` outputs (constructors and void methods) render as an en dash.
 */
export function operationRows(example: Pick<ProblemExample, "args" | "expected">) {
  const [operations, argLists] = example.args as [string[], Json[][]];
  const outputs = example.expected as Json[];
  return operations.map((op, i) => {
    const args = (argLists[i] ?? []).map(show).join(", ");
    return {
      call: i === 0 ? `new ${op}(${args})` : `${op}(${args})`,
      output: outputs[i] === null ? undefined : show(outputs[i]),
    };
  });
}

function OperationsTable({ example }: { example: ProblemExample }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-muted/40">
      <table className="w-full border-collapse font-mono text-[13px] leading-6">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="w-10 px-4 py-1.5 font-normal">
              #
            </th>
            <th scope="col" className="px-4 py-1.5 font-normal">
              operation
            </th>
            <th scope="col" className="px-4 py-1.5 font-normal">
              output
            </th>
          </tr>
        </thead>
        <tbody>
          {operationRows(example).map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-1 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-1 whitespace-nowrap">{row.call}</td>
              <td className="px-4 py-1 whitespace-nowrap">
                {row.output ?? (
                  <>
                    <span aria-hidden className="text-muted-foreground">
                      –
                    </span>
                    <span className="sr-only">no return value</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Examples as code-style blocks (input, output, optional explanation), or operation tables for design problems. */
export function Examples({
  examples,
  format = "call",
}: {
  examples: ProblemExample[];
  format?: Problem["exampleFormat"];
}) {
  return (
    <ol className="space-y-3">
      {examples.map((example, i) => (
        <li key={i}>
          <p className="mb-1.5 text-sm font-medium">Example {i + 1}</p>
          {format === "operations" ? (
            <OperationsTable example={example} />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-muted/40 px-4 py-3 font-mono text-[13px] leading-6">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3">
                <dt className="text-muted-foreground">input</dt>
                <dd className="whitespace-pre-wrap">{example.input}</dd>
                <dt className="text-muted-foreground">output</dt>
                <dd className="whitespace-pre-wrap">{example.output}</dd>
              </dl>
            </div>
          )}
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
