import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/catalog";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

/**
 * Muted badge: the word carries the meaning; a 1–3 bar meter repeats it as a shape. No color coding, so it reads
 * the same in both themes and for color-blind users.
 */
export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  const level = LEVEL[difficulty];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="flex items-end gap-px">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn("w-[3px] rounded-[1px]", bar <= level ? "bg-foreground/70" : "bg-foreground/15")}
            style={{ height: 3 + bar * 2 }}
          />
        ))}
      </span>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
