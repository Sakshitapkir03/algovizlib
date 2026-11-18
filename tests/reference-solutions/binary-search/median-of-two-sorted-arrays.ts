export function solve(nums1: number[], nums2: number[]): number {
  if (nums1.length > nums2.length) return solve(nums2, nums1);
  const m = nums1.length;
  const n = nums2.length;
  const half = Math.floor((m + n + 1) / 2);
  let low = 0;
  let high = m;
  while (low <= high) {
    const i = Math.floor((low + high) / 2);
    const j = half - i;
    const left1 = i > 0 ? nums1[i - 1] : -Infinity;
    const right1 = i < m ? nums1[i] : Infinity;
    const left2 = j > 0 ? nums2[j - 1] : -Infinity;
    const right2 = j < n ? nums2[j] : Infinity;
    if (left1 <= right2 && left2 <= right1) {
      const leftMax = Math.max(left1, left2);
      if ((m + n) % 2 === 1) return leftMax;
      return (leftMax + Math.min(right1, right2)) / 2;
    }
    if (left1 > right2) high = i - 1;
    else low = i + 1;
  }
  throw new Error("inputs must be sorted");
}
