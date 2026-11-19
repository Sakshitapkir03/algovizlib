export function solve(n: number): string[][] {
  const boards: string[][] = [];
  const queenCols: number[] = [];
  const cols = new Set<number>();
  const diag = new Set<number>();
  const anti = new Set<number>();
  const place = (row: number): void => {
    if (row === n) {
      boards.push(queenCols.map((c) => ".".repeat(c) + "Q" + ".".repeat(n - c - 1)));
      return;
    }
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag.has(row - col) || anti.has(row + col)) continue;
      cols.add(col);
      diag.add(row - col);
      anti.add(row + col);
      queenCols.push(col);
      place(row + 1);
      queenCols.pop();
      cols.delete(col);
      diag.delete(row - col);
      anti.delete(row + col);
    }
  };
  place(0);
  return boards;
}
