export function solve(image: number[][], sr: number, sc: number, color: number): number[][] {
  const original = image[sr][sc];
  if (original === color) return image;
  const rows = image.length;
  const cols = image[0].length;
  const queue: [number, number][] = [[sr, sc]];
  image[sr][sc] = color;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let head = 0; head < queue.length; head++) {
    const [r, c] = queue[head];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && image[nr][nc] === original) {
        image[nr][nc] = color;
        queue.push([nr, nc]);
      }
    }
  }
  return image;
}
