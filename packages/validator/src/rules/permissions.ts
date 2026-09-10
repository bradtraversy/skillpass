import type { PermissionKey } from 'skill-schema';
import type { PackageFile } from '../load';

interface PermissionSignal {
	pattern: RegExp;
	permission: PermissionKey;
	description: string;
}

// V0 text signals: instructions that imply a capability. Writing project
// files is assumed baseline for a skill and deliberately not detected.
const PERMISSION_SIGNALS: readonly PermissionSignal[] = [
	{
		pattern: /\b(?:fetch|curl|wget|download)\b/i,
		permission: 'network.fetch',
		description: 'fetches remote data',
	},
	{
		pattern: /\b(?:upload|webhook|send (?:the )?(?:data|results|payload))\b/i,
		permission: 'network.post',
		description: 'transmits data to an external service',
	},
	{
		pattern: /\b(?:run|execute)\b[^\n]*\b(?:command|shell|script)s?\b/i,
		permission: 'shell.execute',
		description: 'runs shell commands',
	},
	{
		pattern: /(?:~\/|\$HOME\b|\bdotfiles?\b|\bhome directory\b)/,
		permission: 'filesystem.read.home',
		description: 'reads files outside the project',
	},
	{
		pattern: /(?:\.env\b|process\.env|\benvironment variables?\b)/i,
		permission: 'env.read',
		description: 'reads environment variables',
	},
	{
		pattern: /\b(?:git push|open (?:a )?pull request|create (?:a )?(?:pr|pull request))\b/i,
		permission: 'connector.github.write',
		description: 'writes to GitHub',
	},
	{
		pattern: /\b(?:npm publish|publish (?:the )?(?:package|site|post|article)|post publicly)\b/i,
		permission: 'external.publish',
		description: 'publishes content externally',
	},
	{
		pattern: /\bdeploy\b/i,
		permission: 'external.deploy',
		description: 'triggers a deployment',
	},
	{
		pattern: /\bsend (?:an? )?e-?mail\b/i,
		permission: 'connector.gmail.send',
		description: 'sends email',
	},
	{
		pattern: /\b(?:rm\s+-\S*rf?\S*\s|delete\s+(?:all|every)\b|permanently\s+delete)/i,
		permission: 'destructive.delete',
		description: 'deletes irreversibly',
	},
];

// Permission keys whose signal fires anywhere in the package, each once, in
// first-seen order.
export function detectPermissions(files: PackageFile[]): PermissionKey[] {
	const detected = new Set<PermissionKey>();
	for (const file of files) {
		for (const line of file.content.split('\n')) {
			for (const signal of PERMISSION_SIGNALS) {
				if (!detected.has(signal.permission) && signal.pattern.test(line)) {
					detected.add(signal.permission);
				}
			}
		}
	}
	return [...detected];
}
