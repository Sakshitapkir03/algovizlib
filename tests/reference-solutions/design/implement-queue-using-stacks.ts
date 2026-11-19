class MyQueue {
  private input: number[] = [];
  private output: number[] = [];

  push(x: number): void {
    this.input.push(x);
  }

  pop(): number {
    this.refill();
    return this.output.pop() as number;
  }

  peek(): number {
    this.refill();
    return this.output[this.output.length - 1];
  }

  empty(): boolean {
    return this.input.length === 0 && this.output.length === 0;
  }

  private refill(): void {
    if (this.output.length > 0) return;
    while (this.input.length > 0) this.output.push(this.input.pop() as number);
  }
}

export function solve(operations: string[], args: number[][]): (number | boolean | null)[] {
  let queue = new MyQueue();
  return operations.map((op, i) => {
    switch (op) {
      case "MyQueue":
        queue = new MyQueue();
        return null;
      case "push":
        queue.push(args[i][0]);
        return null;
      case "pop":
        return queue.pop();
      case "peek":
        return queue.peek();
      case "empty":
        return queue.empty();
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
