export function solve(matrix: number[][], target: number): number {
  const rows = matrix.length;
  const cols = matrix[0].length;
  let count = 0;
  for (let r1 = 0; r1 < rows; r1++) {
    const columnSums = new Array<number>(cols).fill(0);
    for (let r2 = r1; r2 < rows; r2++) {
      for (let c = 0; c < cols; c++) columnSums[c] += matrix[r2][c];
      const seen = new Map<number, number>([[0, 1]]);
      let sum = 0;
      for (const value of columnSums) {
        sum += value;
        count += seen.get(sum - target) ?? 0;
        seen.set(sum, (seen.get(sum) ?? 0) + 1);
      }
    }
  }
  return count;
}
