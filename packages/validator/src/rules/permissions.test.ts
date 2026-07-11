import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Manifest, PermissionKey } from 'skill-schema';
import { loadPackage, type LoadedPackage } from '../load';
import { detectPermissions, permissionsRule } from './permissions';

const fixture = (name: string) => join(import.meta.dirname, '..', '..', 'fixtures', name);

function pkgWith(content: string, permissions: PermissionKey[] = []): LoadedPackage {
	const manifest: Manifest = {
		schemaVersion: '0.1',
		name: 'fake',
		description: 'fake',
		targets: ['claude-code'],
		permissions,
		distribution: 'skill',
	};
	return {
		dir: '/fake',
		files: [{ path: 'SKILL.md', content }],
		manifest: { state: 'ok', data: manifest, raw: '{}' },
		entries: [{ skillName: 'fake', path: 'SKILL.md', exists: true }],
		sourceHash: 'sha256:0',
	};
}

const detectedKeys = (content: string) =>
	detectPermissions(pkgWith(content).files).map((d) => d.permission);

describe('permission signals', () => {
	it.each([
		['network.fetch', 'Fetch the latest release notes from the website.'],
		['network.post', 'Upload the results to the tracking endpoint.'],
		['shell.execute', 'Run the following command in the terminal.'],
		['filesystem.read.home', 'Read ~/.config for the user settings.'],
		['env.read', 'Read the API endpoint from process.env.'],
		['connector.github.write', 'Then git push the changes.'],
		['external.publish', 'npm publish the package when done.'],
		['external.deploy', 'Deploy the site after the build.'],
		['connector.gmail.send', 'Send an email to the maintainer.'],
		['destructive.delete', 'Permanently delete the old backups.'],
	] as const)('detects %s', (permission, line) => {
		expect(detectedKeys(line)).toContain(permission);
	});

	it.each([
		['shell.execute', 'Run the tests and report failures.'],
		['external.deploy', 'Document the deployment strategy.'],
		['connector.gmail.send', 'The sender field is unused.'],
		['destructive.delete', 'Delete the draft paragraph if the user agrees.'],
	] as const)('does not detect %s from near-miss prose', (permission, line) => {
		expect(detectedKeys(line)).not.toContain(permission);
	});

	it('deduplicates repeated signals to one detection at the first location', () => {
		const detected = detectPermissions(
			pkgWith('Fetch the readme.\nThen fetch the changelog.\nAnd download the icons.').files,
		);
		const fetches = detected.filter((d) => d.permission === 'network.fetch');
		expect(fetches).toHaveLength(1);
		expect(fetches[0].location.line).toBe(1);
	});
});

describe('permissionsRule', () => {
	it('reports nothing when the detected permission is declared', () => {
		expect(permissionsRule(pkgWith('Fetch the notes.', ['network.fetch']))).toEqual([]);
	});

	it('warns on an undeclared low-risk permission', () => {
		const findings = permissionsRule(pkgWith('Fetch the notes.'));
		expect(findings).toEqual([
			expect.objectContaining({
				severity: 'warning',
				code: 'undeclared-permission',
				message: expect.stringContaining('network.fetch'),
			}),
		]);
	});

	it('fails on an undeclared critical permission', () => {
		const findings = permissionsRule(pkgWith('Run this shell command to start.'));
		expect(findings).toEqual([
			expect.objectContaining({
				severity: 'failure',
				code: 'undeclared-critical-permission',
				message: expect.stringContaining('shell.execute'),
			}),
		]);
	});

	it('warns on the undeclared-network fixture', () => {
		const findings = permissionsRule(loadPackage(fixture('undeclared-network')));
		expect(findings).toEqual([
			expect.objectContaining({ severity: 'warning', code: 'undeclared-permission' }),
		]);
	});

	it('reports nothing for the clean fixtures', () => {
		expect(permissionsRule(loadPackage(fixture('clean-skill')))).toEqual([]);
		expect(permissionsRule(loadPackage(fixture('workflow-pack')))).toEqual([]);
	});
});
