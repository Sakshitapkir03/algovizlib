import type { LessonKind } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** "⚠ incident replay" or "↗ growth story": a glyph and words, never color alone. */
export const KIND_LABEL: Record<LessonKind, { glyph: string; words: string }> = {
  incident: { glyph: "⚠", words: "incident replay" },
  growth: { glyph: "↗", words: "growth story" },
};

export function KindBadge({ kind, className }: { kind: LessonKind; className?: string }) {
  const { glyph, words } = KIND_LABEL[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{glyph}</span>
      {words}
    </span>
  );
}
