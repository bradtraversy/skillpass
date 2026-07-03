import { describe, expect, it } from 'vitest';
import { riskLevelFor } from './score';

describe('riskLevelFor', () => {
	it.each([
		[[], 'low'],
		[['filesystem.read.project'], 'low'],
		[['filesystem.read.home'], 'medium'],
		[['env.read'], 'medium'],
		[['shell.execute'], 'high'],
		[['connector.gmail.send'], 'high'],
		[['external.payment'], 'critical'],
		[['destructive.delete'], 'critical'],
		[['filesystem.read.project', 'shell.execute'], 'high'],
	] as const)('%j -> %s', (keys, level) => {
		expect(riskLevelFor(keys)).toBe(level);
	});
});
