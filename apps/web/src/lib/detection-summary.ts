import type { DetectedPackage } from 'skill-schema';

// One line under the submit form describing what the validator found.
export function detectionSummary(detected: DetectedPackage): { tone: string; text: string } {
	if (detected.skillCount) {
		return {
			tone: 'text-pass',
			text: `${detected.skillCount}-skill pack - will list as "${detected.name}"`,
		};
	}
	switch (detected.manifest) {
		case 'ok':
			return { tone: 'text-pass', text: `skill.json found - will list as "${detected.name}"` };
		case 'inferred':
			return { tone: 'text-pass', text: `SKILL.md found - will list as "${detected.name}"` };
		case 'invalid':
			return { tone: 'text-warn', text: 'skill.json is not valid - validation will flag it' };
		case 'missing':
			return {
				tone: 'text-warn',
				text: 'no SKILL.md at the top level - validation will fail; submit the folder that contains it',
			};
	}
}
