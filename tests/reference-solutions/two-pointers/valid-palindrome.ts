function isAlphanumeric(ch: string): boolean {
  return /^[a-z0-9]$/i.test(ch);
}

export function solve(s: string): boolean {
  let left = 0;
  let right = s.length - 1;
  while (left < right) {
    if (!isAlphanumeric(s[left])) {
      left++;
    } else if (!isAlphanumeric(s[right])) {
      right--;
    } else {
      if (s[left].toLowerCase() !== s[right].toLowerCase()) return false;
      left++;
      right--;
    }
  }
  return true;
}
