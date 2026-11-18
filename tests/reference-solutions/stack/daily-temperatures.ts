export function solve(temps: number[]): number[] {
  const waits = new Array<number>(temps.length).fill(0);
  const waiting: number[] = [];
  for (let i = 0; i < temps.length; i++) {
    while (waiting.length > 0 && temps[waiting[waiting.length - 1]] < temps[i]) {
      const day = waiting.pop() as number;
      waits[day] = i - day;
    }
    waiting.push(i);
  }
  return waits;
}
