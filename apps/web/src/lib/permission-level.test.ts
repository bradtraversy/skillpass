import { describe, expect, it } from 'vitest';
import { permissionLevel } from './permission-level';

describe('permissionLevel', () => {
	it('maps weights to the same thresholds as the validator', () => {
		expect(permissionLevel('filesystem.read.project')).toBe('low'); // weight 1
		expect(permissionLevel('env.read')).toBe('medium'); // weight 5
		expect(permissionLevel('shell.execute')).toBe('high'); // weight 7
		expect(permissionLevel('external.payment')).toBe('critical'); // weight 9
	});
});
