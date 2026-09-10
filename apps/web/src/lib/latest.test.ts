import { describe, expect, it } from 'vitest';
import { latestOnly } from './latest';

describe('latestOnly', () => {
	it('treats only the most recently started request as current', () => {
		const requests = latestOnly();
		const first = requests.start();
		expect(requests.isCurrent(first)).toBe(true);
		const second = requests.start();
		expect(requests.isCurrent(first)).toBe(false);
		expect(requests.isCurrent(second)).toBe(true);
	});
});
