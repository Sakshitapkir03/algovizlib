export function solve(prices: number[], target: number): number[] {
  let left = 0;
  let right = prices.length - 1;
  while (left < right) {
    const sum = prices[left] + prices[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return [];
}
