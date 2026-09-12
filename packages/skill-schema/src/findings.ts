export interface FindingCopy {
	label: string;
	description: string;
}

// Display copy for validator finding codes. Findings are pattern matches, not
// verdicts, so the copy names what matched and invites review; the stored
// report message stays the forensic detail. Passports are immutable, so the UI
// maps codes at render time instead of rewriting stored summaries.
export const FINDING_COPY: Record<string, FindingCopy> = {
	'credential-harvesting': {
		label: 'Credential access pattern',
		description:
			'Wording here matches patterns used to locate or extract secrets. This is common in legitimate security tools and docs - read the flagged line to judge intent.',
	},
	'dangerous-command': {
		label: 'Dangerous command pattern',
		description:
			'Matches a command shape that can change or damage a system, like piped installers or forced deletes. Check what the skill actually asks the agent to run.',
	},
	malware: {
		label: 'Malware phrase pattern',
		description:
			'Matches phrasing associated with planting malicious artifacts. Read the flagged line to see whether it instructs or merely discusses it.',
	},
	'prompt-injection': {
		label: 'Prompt-injection pattern',
		description:
			"Matches wording that tries to steer the agent beyond the skill's stated job, like overriding earlier instructions or hiding directives.",
	},
	'secret-pattern': {
		label: 'Possible secret value',
		description:
			'Text here looks like a real credential value. Publishing would leak it, so this finding blocks instead of advising.',
	},
	'empty-package': {
		label: 'Empty package',
		description: 'The package contains no usable files.',
	},
	'invalid-manifest': {
		label: 'Invalid manifest',
		description: 'The skill.json manifest is present but does not match the expected shape.',
	},
	'missing-manifest': {
		label: 'No manifest',
		description: 'No skill.json was found, so the listing details were inferred from SKILL.md content.',
	},
	'missing-skill-file': {
		label: 'Missing SKILL.md',
		description: 'The package has no SKILL.md, so there are no agent instructions to review.',
	},
};

export function findingCopy(code: string): FindingCopy | null {
	return FINDING_COPY[code] ?? null;
}
