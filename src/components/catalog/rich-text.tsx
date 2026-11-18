import { Fragment, type ReactNode } from "react";

/** `like this` → <code>. Everything else is plain text (no HTML from content, ever). */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code key={i} className="code-inline">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Renders authored prose: paragraphs split on blank lines, a block whose lines all start with "- " becomes a
 * bulleted list, and `backticks` become inline code. Deliberately tiny; content never contains HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={className}>
      {blocks.map((block, i): ReactNode => {
        const lines = block.split("\n").map((l) => l.trim());
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineText text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <InlineText text={lines.join(" ")} />
          </p>
        );
      })}
    </div>
  );
}
