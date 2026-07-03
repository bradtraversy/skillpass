import { describe, expect, it } from 'vitest';
import {
	PERMISSION_KEYS,
	PERMISSIONS,
	permissionGroup,
	permissionKeySchema,
	riskWeightOf,
} from './permissions';

describe('permission taxonomy', () => {
	it('has unique keys', () => {
		expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
	});

	it('defines every key with a label, description, and weight', () => {
		expect(PERMISSIONS).toHaveLength(PERMISSION_KEYS.length);
		for (const p of PERMISSIONS) {
			expect(p.label).not.toBe('');
			expect(p.description).not.toBe('');
			expect(p.riskWeight).toBeGreaterThan(0);
		}
	});

	it.each([...PERMISSION_KEYS])('parses %s', (key) => {
		expect(permissionKeySchema.parse(key)).toBe(key);
	});

	it('rejects an unknown key', () => {
		expect(permissionKeySchema.safeParse('filesystem.format.disk').success).toBe(false);
	});
});

describe('permissionGroup', () => {
	it.each([
		['filesystem.read.project', 'filesystem'],
		['env.read', 'env'],
		['shell.execute', 'shell'],
		['network.post', 'network'],
		['connector.github.read', 'connector'],
		['external.payment', 'external'],
		['destructive.delete', 'destructive'],
	] as const)('%s -> %s', (key, group) => {
		expect(permissionGroup(key)).toBe(group);
	});
});

describe('risk weights', () => {
	const readOnlyKeys = PERMISSION_KEYS.filter((key) => key.includes('.read'));
	const highRiskKeys = ['shell.execute', 'external.payment', 'destructive.delete'] as const;

	it.each(highRiskKeys)('%s outranks every read-only key', (riskyKey) => {
		for (const readKey of readOnlyKeys) {
			expect(riskWeightOf(riskyKey)).toBeGreaterThan(riskWeightOf(readKey));
		}
	});
});
