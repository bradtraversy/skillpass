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
];

const ALL_ROWS = [...SECRET_PATTERNS, ...INJECTION_PATTERNS, ...DANGEROUS_PATTERNS];

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
