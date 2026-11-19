export function solve(numCourses: number, prerequisites: number[][]): boolean {
  const next: number[][] = Array.from({ length: numCourses }, () => []);
  const inDegree = new Array<number>(numCourses).fill(0);
  for (const [course, needed] of prerequisites) {
    next[needed].push(course);
    inDegree[course]++;
  }
  const queue: number[] = [];
  for (let i = 0; i < numCourses; i++) if (inDegree[i] === 0) queue.push(i);
  let taken = 0;
  for (let head = 0; head < queue.length; head++) {
    taken++;
    for (const course of next[queue[head]]) {
      if (--inDegree[course] === 0) queue.push(course);
    }
  }
  return taken === numCourses;
}
