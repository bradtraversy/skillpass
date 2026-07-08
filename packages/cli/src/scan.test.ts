import { fileURLToPath } from 'node:url';
import { validationReportSchema } from 'skill-schema';
import { describe, expect, it } from 'vitest';
import { runScan } from './scan';

const fixture = (name: string) =>
	fileURLToPath(new URL(`../../validator/fixtures/${name}`, import.meta.url));

describe('runScan', () => {
	it('passes a clean skill with exit 0 and a readable report', async () => {
		const result = await runScan(fixture('clean-skill'));
		expect(result.exitCode).toBe(0);
		const text = result.lines.join('\n');
		expect(text).toContain('Status   PASSED');
		expect(text).toContain('Source   sha256:');
		expect(text).toContain('No findings.');
	});

	it('fails a leaked-secret skill with exit 1 and path:line findings', async () => {
		const result = await runScan(fixture('leaked-secret'));
		expect(result.exitCode).toBe(1);
		const text = result.lines.join('\n');
		expect(text).toContain('Status   FAILED');
		expect(text).toMatch(/Failures \(\d+\)/);
		expect(text).toMatch(/\[[^\]]+:\d+\]/);
	});

	it('renders detected permissions with taxonomy labels', async () => {
		const result = await runScan(fixture('undeclared-network'));
		const text = result.lines.join('\n');
		expect(text).toContain('Permissions');
		expect(text).toMatch(/network\.\w+ - /);
	});

	it('emits schema-valid JSON with --json', async () => {
		const result = await runScan(fixture('clean-skill'), { json: true });
		expect(result.exitCode).toBe(0);
		const parsed = validationReportSchema.parse(JSON.parse(result.lines.join('\n')));
		expect(parsed.status).toBe('passed');
	});

	it('keeps exit 1 for failed scans even with --json', async () => {
		const result = await runScan(fixture('leaked-secret'), { json: true });
		expect(result.exitCode).toBe(1);
	});

	it('exits 2 with a readable message for an unreadable path', async () => {
		const result = await runScan('/nope/definitely-not-a-skill');
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('could not read a skill package');
	});
});
