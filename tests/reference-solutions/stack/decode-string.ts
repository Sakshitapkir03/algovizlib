export function solve(s: string): string {
  const stack: { prefix: string; count: number }[] = [];
  let current = "";
  let count = 0;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      count = count * 10 + Number(ch);
    } else if (ch === "[") {
      stack.push({ prefix: current, count });
      current = "";
      count = 0;
    } else if (ch === "]") {
      const frame = stack.pop() as { prefix: string; count: number };
      current = frame.prefix + current.repeat(frame.count);
    } else {
      current += ch;
    }
  }
  return current;
}
