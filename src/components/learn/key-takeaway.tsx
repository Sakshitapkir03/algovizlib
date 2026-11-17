import { Check, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Analogy, Takeaway } from "@/lib/storyboard";

export function KeyTakeaway({ takeaway, analogy }: { takeaway: Takeaway; analogy?: Analogy }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles aria-hidden className="size-4 text-primary" />
          Key takeaway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-semibold">{takeaway.pattern}</p>
          <p className="mt-1 text-muted-foreground">{takeaway.summary}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Time</dt>
            <dd className="font-mono text-lg font-semibold">{takeaway.timeComplexity}</dd>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Space</dt>
            <dd className="font-mono text-lg font-semibold">{takeaway.spaceComplexity}</dd>
          </div>
        </dl>
        {takeaway.whenToUse.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              When to use it
            </p>
            <ul className="space-y-1.5">
              {takeaway.whenToUse.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {analogy ? (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              From the story to the code
            </p>
            <table className="w-full text-left">
              <caption className="sr-only">How the analogy maps to the abstract problem</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-1 font-medium">
                    In the story
                  </th>
                  <th scope="col" className="pb-1 font-medium">
                    In the problem
                  </th>
                </tr>
              </thead>
              <tbody>
                {analogy.mapping.map((row) => (
                  <tr key={row.real} className="border-t">
                    <td className="py-1.5 pr-2">{row.real}</td>
                    <td className="py-1.5 font-mono text-xs">{row.abstract}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
