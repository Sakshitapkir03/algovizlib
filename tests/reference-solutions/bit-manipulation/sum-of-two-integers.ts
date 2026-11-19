export function solve(a: number, b: number): number {
  let x = a | 0;
  let y = b | 0;
  while (y !== 0) {
    const carry = (x & y) << 1;
    x = x ^ y;
    y = carry;
  }
  return x;
}
