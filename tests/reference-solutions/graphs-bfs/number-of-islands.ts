export function solve(grid: string[]): number {
  const rows = grid.length;
  const cols = grid[0].length;
  const seen = grid.map(() => new Array<boolean>(cols).fill(false));
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== "1" || seen[r][c]) continue;
      count++;
      seen[r][c] = true;
      const queue: [number, number][] = [[r, c]];
      for (let head = 0; head < queue.length; head++) {
        const [cr, cc] = queue[head];
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === "1" && !seen[nr][nc]) {
            seen[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
  return count;
}
