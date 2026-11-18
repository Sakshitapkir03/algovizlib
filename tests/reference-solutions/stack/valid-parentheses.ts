const OPENER: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

export function solve(s: string): boolean {
  const stack: string[] = [];
  for (const ch of s) {
    const opener = OPENER[ch];
    if (opener === undefined) {
      stack.push(ch);
    } else if (stack.pop() !== opener) {
      return false;
    }
  }
  return stack.length === 0;
}
