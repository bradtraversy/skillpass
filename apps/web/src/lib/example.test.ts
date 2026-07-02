import { describe, expect, it } from 'vitest';

// Placeholder proving the Vitest runner and the testing gate work.
// Replace with the first real logic test (the filterSkills helper) when
// feature 1's search/filter island lands. See current-feature.md Testing.
function sum(nums: number[]): number {
  return nums.reduce((total, n) => total + n, 0);
}

describe('example', () => {
  it('sums an empty list to zero', () => {
    expect(sum([])).toBe(0);
  });

  it('sums a list of numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
});
