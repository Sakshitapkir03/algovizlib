class MinStack {
  private values: number[] = [];
  private mins: number[] = [];

  push(val: number): void {
    const min = this.mins.length === 0 ? val : Math.min(val, this.mins[this.mins.length - 1]);
    this.values.push(val);
    this.mins.push(min);
  }

  pop(): void {
    this.values.pop();
    this.mins.pop();
  }

  top(): number {
    return this.values[this.values.length - 1];
  }

  getMin(): number {
    return this.mins[this.mins.length - 1];
  }
}

export function solve(operations: string[], args: number[][]): (number | null)[] {
  let stack = new MinStack();
  return operations.map((op, i) => {
    switch (op) {
      case "MinStack":
        stack = new MinStack();
        return null;
      case "push":
        stack.push(args[i][0]);
        return null;
      case "pop":
        stack.pop();
        return null;
      case "top":
        return stack.top();
      case "getMin":
        return stack.getMin();
      default:
        throw new Error(`unknown operation ${op}`);
    }
  });
}
