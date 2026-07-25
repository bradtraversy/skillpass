import type { Rule, RuleFinding } from './types';

export interface PatternRow {
	code: string;
	pattern: RegExp;
	message: string;
	redact?: boolean; // strip the matched text from the snippet (secrets)
	severity?: 'warning' | 'failure'; // defaults to failure
}

export const SECRET_PATTERNS: readonly PatternRow[] = [
	{
		code: 'secret-pattern',
		pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
		message: 'contains a GitHub token',
		redact: true,
	},
	{
		code: 'secret-pattern',
		pattern: /\bAKIA[0-9A-Z]{16}\b/,
		message: 'contains an AWS access key id',
		redact: true,
	},
	{
		code: 'secret-pattern',
		pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
		message: 'contains an sk- API key',
		redact: true,
	},
	{
		code: 'secret-pattern',
		pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
		message: 'contains a PEM private key block',
		redact: true,
	},
	{
		// Generic assignment: warns rather than fails, and skips obvious doc
		// placeholders (your-key, <token>, example, changeme). The format-specific
		// detectors above catch real leaked keys with high confidence and fail.
		code: 'secret-pattern',
		pattern:
			/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'](?!(?:your|my|example|sample|dummy|fake|changeme|placeholder|insert|replace|todo|xxx|test)[-_ ]|<)[^"']{12,}["']/i,
		message: 'assigns a credential-shaped value',
		redact: true,
		severity: 'warning',
	},
];

export const INJECTION_PATTERNS: readonly PatternRow[] = [
	{
		code: 'prompt-injection',
		pattern: /\bignore\s+(?:all\s+|any\s+)?(?:previous|prior|earlier|above)\s+instructions?\b/i,
		message: 'instructs the agent to ignore prior instructions',
	},
	{
		code: 'prompt-injection',
		pattern: /\bdisregard\s+(?:your\s+|the\s+)?(?:system|developer)\s+(?:prompt|instructions?|rules)\b/i,
		message: 'instructs the agent to disregard its system rules',
	},
	{
		code: 'prompt-injection',
		pattern: /\bbypass\s+(?:the\s+|any\s+)?(?:approval|permission|review)/i,
		message: 'instructs the agent to bypass an approval gate',
	},
];

export const DANGEROUS_PATTERNS: readonly PatternRow[] = [
	{
		code: 'dangerous-command',
		pattern: /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/,
		message: 'pipes a downloaded script into a shell',
	},
	{
		// Only catastrophic targets: an absolute path (not /tmp), home, or $HOME.
		// Relative targets like `dist`, `build`, `./out` are normal build cleanup
		// and must not trip this.
		code: 'dangerous-command',
		pattern: /\brm\s+-(?:\S*r\S*f|\S*f\S*r)\S*\s+(?:-\S+\s+)*(?:\/(?!tmp\b)|~|\$HOME\b)/,
		message: 'recursively force-deletes an absolute or home path',
	},
	{
		code: 'dangerous-command',
		pattern: /\bbase64\s+(?:-d|--decode)\b[^|\n]*\|\s*(?:ba|z)?sh\b/,
		message: 'decodes and executes an encoded payload',
	},
	// Natural-language destruction: unbounded or system-wide targets only.
	// Bounded cleanup ("delete this file", "remove the dist folder") must not trip.
	{
		code: 'dangerous-command',
		pattern:
			/\b(?:deletes?|removes?|wipes?|erases?|destroys?|nukes?)\b[^.\n]{0,40}?\b(?:all|every|everything|entire)\b[^.\n]{0,40}?\b(?:files?|data|folders?)\b/i,
		message: 'instructs deleting all user files or data',
	},
	{
		code: 'dangerous-command',
		pattern:
			/\b(?:wipes?|erases?|destroys?|formats?|nukes?)\b[^.\n]{0,40}?\b(?:system|disk|drive|machine|computer|home\s+director(?:y|ies))\b/i,
		message: 'instructs destroying a system-level target',
	},
];

// Harmful-intent rows catch canonical phrasings only (precision over recall);
// paraphrased malice is the LLM review layer's job (feature 18).
export const MALWARE_PATTERNS: readonly PatternRow[] = [
	{
		code: 'malware',
		pattern:
			/\b(?:adds?|installs?|plants?|drops?|deploys?|injects?|hides?|embeds?|sets?\s+up|creates?)\s+(?:[\w'-]+\s+){0,2}(?:backdoor|trojan|keylogger|rootkit|ransomware|botnet|reverse\s+shell)s?\b/i,
		message: 'instructs planting a malware artifact',
	},
];

const SECRET_STORE =
	/(?<![\w.])\.(?:env|aws|ssh|npmrc|netrc)\b|\bid_rsa\b|\bkeychain\b|\bcredentials?\s+files?\b/.source;
const SECRET_NOUN = /\b(?:passwords?|credentials?|secrets?|api[\s-]?keys?|tokens?|private\s+keys?)\b/
	.source;

export const CREDENTIAL_PATTERNS: readonly PatternRow[] = [
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`\b(?:greps?|search(?:es)?|scans?|finds?|locates?|enumerates?|collects?|gathers?)\b[^.\n]{0,60}?(?:${SECRET_STORE})`,
			'i',
		),
		message: 'searches for a credential file or store',
	},
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`\b(?:greps?|search(?:es)?|scans?|finds?|locates?|enumerates?|collects?|gathers?)\b(?=[^.\n]*\b(?:filesystem|file\s+system|home\s+dir(?:ectory)?|machine|disk|computer)\b)(?=[^.\n]*${SECRET_NOUN})`,
			'i',
		),
		message: 'searches the machine for secrets',
	},
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`(?<!\b(?:never|not|don'?t)\s)\b(?:exfiltrates?|steals?|harvests?|dumps?|leaks?)\b[^.\n]{0,60}?${SECRET_NOUN}`,
			'i',
		),
		message: 'exfiltrates or steals credentials',
	},
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`^(?=.*(?:${SECRET_STORE}))(?=.*(?<!\b(?:never|not|don'?t|avoid)\s)\b(?:post|send|curl|transmit|exfiltrate)s?\b)`,
			'i',
		),
		message: 'transmits a credential file over the network',
	},
];

const ALL_ROWS = [
	...SECRET_PATTERNS,
	...INJECTION_PATTERNS,
	...DANGEROUS_PATTERNS,
	...MALWARE_PATTERNS,
	...CREDENTIAL_PATTERNS,
];

export const contentRule: Rule = (pkg) => {
	const findings: RuleFinding[] = [];
	for (const file of pkg.files) {
		file.content.split('\n').forEach((line, i) => {
			for (const row of ALL_ROWS) {
				if (row.pattern.test(line)) {
					const snippet = row.redact ? line.trim().replace(row.pattern, '[redacted]') : line.trim();
					findings.push({
						severity: row.severity ?? 'failure',
						code: row.code,
						message: row.message,
						location: { path: file.path, line: i + 1, snippet },
					});
				}
			}
		});
	}
	return findings;
};
