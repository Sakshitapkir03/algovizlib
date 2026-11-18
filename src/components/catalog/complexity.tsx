import type { Complexity } from "@/lib/catalog";

/** Code-style time/space pair. */
export function ComplexityBlock({ complexity }: { complexity: Complexity }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-4 py-3 font-mono text-sm">
      <dt className="text-muted-foreground">time</dt>
      <dd>{complexity.time}</dd>
      <dt className="text-muted-foreground">space</dt>
      <dd>{complexity.space}</dd>
    </dl>
  );
}
