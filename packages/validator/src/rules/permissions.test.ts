import { describe, expect, it } from 'vitest';
import type { Manifest, PermissionKey } from 'skill-schema';
import type { LoadedPackage } from '../load';
import { detectPermissions } from './permissions';

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
		files: [{ path: 'SKILL.md', content }],
		manifest: { state: 'ok', data: manifest },
		entries: [{ skillName: 'fake', path: 'SKILL.md', exists: true }],
		sourceHash: 'sha256:0',
		binaries: [],
	};
}

const detectedKeys = (content: string) =>
	detectPermissions(pkgWith(content).files);

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

	it('reports a repeated signal once', () => {
		const detected = detectPermissions(
			pkgWith('Fetch the readme.\nThen fetch the changelog.\nAnd download the icons.').files,
		);
		expect(detected.filter((key) => key === 'network.fetch')).toHaveLength(1);
	});
});
