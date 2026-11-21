import type { TracePile, TracePileItem } from "../types";

/** A stack the traces push and pop exactly like the reference solutions, snapshotting it for each step. */
export class Pile {
  readonly items: TracePileItem[] = [];
  private pushed = 0;
  private popped: TracePileItem[] = [];
  private links: NonNullable<TracePile["links"]> = [];
  readonly answers = new Map<number, string>();

  constructor(private readonly order?: "increasing" | "decreasing") {}

  get size(): number {
    return this.items.length;
  }

  top(): TracePileItem | undefined {
    return this.items.at(-1);
  }

  push(item: TracePileItem) {
    this.items.push(item);
    this.pushed++;
  }

  pop(): TracePileItem {
    const item = this.items.pop()!;
    this.popped.push(item);
    return item;
  }

  /** A pop that resolved an answer: drawn as a link on the input row, and kept under the input. */
  resolve(from: number, to: number, label: string, answer?: string) {
    this.links.push({ from, to, label });
    if (answer !== undefined) this.answers.set(from, answer);
  }

  snapshot(text?: TracePile["text"]): TracePile {
    const pile: TracePile = {
      items: this.items.map((item) => ({ ...item })),
      ...(this.order ? { order: this.order } : {}),
      ...(this.pushed > 0 ? { pushed: Math.min(this.pushed, this.items.length) } : {}),
      ...(this.popped.length ? { popped: this.popped.map((item) => ({ ...item })) } : {}),
      ...(this.links.length ? { links: this.links } : {}),
      ...(this.answers.size
        ? { answers: [...this.answers].sort(([a], [b]) => a - b).map(([index, label]) => ({ index, label })) }
        : {}),
      ...(text ? { text } : {}),
    };
    this.pushed = 0;
    this.popped = [];
    this.links = [];
    return pile;
  }
}
