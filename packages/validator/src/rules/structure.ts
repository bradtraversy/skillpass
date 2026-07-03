import type { Rule, RuleFinding } from './types';

export const structureRule: Rule = (pkg) => {
	if (pkg.files.length === 0) {
		return [
			{
				severity: 'failure',
				code: 'empty-package',
				message: 'the package contains no files',
			},
		];
	}

	const findings: RuleFinding[] = [];

	if (pkg.manifest.state === 'missing') {
		findings.push({
			severity: 'warning',
			code: 'missing-manifest',
			message: 'no skill.json manifest; permissions and targets are undeclared',
		});
	} else if (pkg.manifest.state === 'invalid') {
		findings.push({
			severity: 'failure',
			code: 'invalid-manifest',
			message: `skill.json is invalid: ${pkg.manifest.error}`,
			location: { path: 'skill.json' },
		});
	}

	for (const entry of pkg.entries) {
		if (!entry.exists) {
			findings.push({
				severity: 'failure',
				code: 'missing-skill-file',
				message: `skill "${entry.skillName}" references "${entry.path}", which does not exist`,
				location: { path: entry.path },
			});
		} else {
			const file = pkg.files.find((f) => f.path === entry.path);
			if (file !== undefined && file.content.trim() === '') {
				findings.push({
					severity: 'failure',
					code: 'missing-skill-file',
					message: `skill "${entry.skillName}" entry "${entry.path}" is empty`,
					location: { path: entry.path },
				});
			}
		}
	}

	return findings;
};
