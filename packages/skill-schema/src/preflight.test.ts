import { describe, expect, it } from 'vitest';
import { diffPermissions, publicPreflightSchema, type PublicPreflight } from './preflight';

describe('diffPermissions', () => {
	it('reports added and removed keys', () => {
		expect(
			diffPermissions(['network.fetch', 'shell.execute'], ['network.fetch', 'env.read']),
		).toEqual({ added: ['shell.execute'], removed: ['env.read'] });
	});

	it('is empty when the sets match', () => {
		expect(diffPermissions(['env.read'], ['env.read'])).toEqual({ added: [], removed: [] });
	});

	it('treats everything as added against an empty previous set', () => {
		expect(diffPermissions(['env.read', 'network.fetch'], [])).toEqual({
			added: ['env.read', 'network.fetch'],
			removed: [],
		});
	});

	it('handles both sets empty', () => {
		expect(diffPermissions([], [])).toEqual({ added: [], removed: [] });
	});

	it('preserves input order in added and removed', () => {
		const diff = diffPermissions(
			['shell.execute', 'env.read', 'network.post'],
			['network.fetch', 'destructive.delete'],
		);
		expect(diff.added).toEqual(['shell.execute', 'env.read', 'network.post']);
		expect(diff.removed).toEqual(['network.fetch', 'destructive.delete']);
	});
});

const preflight: PublicPreflight = {
	version: '2.0.0',
	validationStatus: 'passed',
	riskLevel: 'medium',
	sourceHash: 'sha256:abc',
	sourceVerified: true,
	resolvedCommitSha: 'a1b2c3d',
	generatedAt: '2026-07-08T10:00:00.000Z',
	permissions: { declared: ['network.fetch'], detected: ['network.fetch', 'shell.execute'] },
	diff: {
		previousVersion: '1.0.0',
		declared: { added: [], removed: [] },
		detected: { added: ['shell.execute'], removed: [] },
	},
	blocked: false,
	blockedReason: null,
};

describe('publicPreflightSchema', () => {
	it('parses a valid preflight', () => {
		expect(publicPreflightSchema.parse(preflight)).toEqual(preflight);
	});

	it('accepts a first version: null diff and null commit sha', () => {
		const first = { ...preflight, diff: null, resolvedCommitSha: null };
		expect(publicPreflightSchema.parse(first)).toEqual(first);
	});

	it('accepts a blocked preflight with a reason', () => {
		const blocked = {
			...preflight,
			validationStatus: 'failed',
			blocked: true,
			blockedReason: 'this version failed validation',
		};
		expect(publicPreflightSchema.parse(blocked).blocked).toBe(true);
	});

	it('strips extra keys so older clients survive additive fields', () => {
		const parsed = publicPreflightSchema.safeParse({ ...preflight, snapshotKey: 'x' });
		expect(parsed.success).toBe(true);
		expect(parsed.success && 'snapshotKey' in parsed.data).toBe(false);
	});

	it('strips extra keys inside the diff', () => {
		const widened = { ...preflight, diff: { ...preflight.diff, snapshotKey: 'x' } };
		const parsed = publicPreflightSchema.safeParse(widened);
		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data.diff !== null && 'snapshotKey' in parsed.data.diff).toBe(
			false,
		);
	});

	it('rejects an unknown permission key', () => {
		const broken = {
			...preflight,
			permissions: { declared: ['root.everything'], detected: [] },
		};
		expect(publicPreflightSchema.safeParse(broken).success).toBe(false);
	});
});
