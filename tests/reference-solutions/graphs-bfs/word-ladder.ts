export function solve(beginWord: string, endWord: string, wordList: string[]): number {
  const unused = new Set(wordList);
  if (!unused.has(endWord)) return 0;
  unused.delete(beginWord);
  let level: string[] = [beginWord];
  let length = 1;
  while (level.length > 0) {
    const next: string[] = [];
    for (const word of level) {
      if (word === endWord) return length;
      for (let i = 0; i < word.length; i++) {
        for (let code = 97; code <= 122; code++) {
          const candidate = word.slice(0, i) + String.fromCharCode(code) + word.slice(i + 1);
          if (unused.has(candidate)) {
            unused.delete(candidate);
            next.push(candidate);
          }
        }
      }
    }
    level = next;
    length++;
  }
  return 0;
}
