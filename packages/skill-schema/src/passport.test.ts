import { describe, expect, it } from 'vitest';
import { parsePassport } from './passport';

function passport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		schemaVersion: '0.1',
		validationStatus: 'warning',
		riskLevel: 'medium',
		permissionsSummary: {
			declared: ['filesystem.read.project', 'network.fetch'],
			detected: ['filesystem.read.project', 'network.fetch', 'network.post'],
		},
		warningsSummary: [{ code: 'undeclared-permission', message: 'network.post detected but not declared' }],
		sourceHash: 'sha256:abc123',
		resolvedCommitSha: '9e7b5a0',
		engineVersion: '0.1.0',
		generatedAt: '2026-07-03T12:00:00Z',
		...overrides,
	};
}

describe('parsePassport accepts', () => {
	it('a full passport', () => {
		expect(parsePassport(passport()).success).toBe(true);
	});

	it('a zip-sourced passport without a commit sha or signature', () => {
		const { resolvedCommitSha: _sha, ...rest } = passport();
		expect(parsePassport(rest).success).toBe(true);
	});
});

describe('parsePassport rejects', () => {
	it('an unknown permission key in the summary', () => {
		expect(
			parsePassport(passport({ permissionsSummary: { declared: ['filesystem.chmod'], detected: [] } }))
				.success,
		).toBe(false);
	});

	it('a missing sourceHash', () => {
		const { sourceHash: _hash, ...rest } = passport();
		expect(parsePassport(rest).success).toBe(false);
	});

	it('a non-ISO generatedAt', () => {
		expect(parsePassport(passport({ generatedAt: 'yesterday' })).success).toBe(false);
	});

	it('an unknown top-level key', () => {
		expect(parsePassport(passport({ installCount: 40200 })).success).toBe(false);
	});
});
