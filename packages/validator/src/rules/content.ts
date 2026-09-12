import type { Rule, RuleFinding } from './types';

interface PatternRow {
	code: string;
	pattern: RegExp;
	message: string;
	redact?: boolean; // strip the matched text from the snippet (secrets)
	severity?: 'warning' | 'failure'; // defaults to failure
	mentionAware?: boolean; // skip matches that only describe or quote the pattern
}

const SECRET_PATTERNS: readonly PatternRow[] = [
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

const INJECTION_PATTERNS: readonly PatternRow[] = [
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

const DANGEROUS_PATTERNS: readonly PatternRow[] = [
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
		// `machine(?!-)` so "machine-parseable"/"machine-readable" don't read as a
		// destruction target.
		code: 'dangerous-command',
		pattern:
			/\b(?:wipes?|erases?|destroys?|formats?|nukes?)\b[^.\n]{0,40}?\b(?:system|disk|drive|machine(?!-)|computer|home\s+director(?:y|ies))\b/i,
		message: 'instructs destroying a system-level target',
	},
];

// Harmful-intent rows catch canonical phrasings only (precision over recall);
// paraphrased malice is the LLM review layer's job (feature 18).
const MALWARE_PATTERNS: readonly PatternRow[] = [
	{
		code: 'malware',
		pattern:
			/\b(?:adds?|installs?|plants?|drops?|deploys?|injects?|hides?|embeds?|sets?\s+up|creates?)\s+(?:[\w'-]+\s+){0,2}(?:backdoor|trojan|keylogger|rootkit|ransomware|botnet|reverse\s+shell)s?\b/i,
		message: 'instructs planting a malware artifact',
	},
];

const SECRET_STORE = /(?<![\w.])\.(?:env|aws|ssh|npmrc|netrc)\b|\bid_rsa\b|\bkeychain\b|\bcredentials?\s+files?\b/
	.source;
const SECRET_NOUN = /\b(?:passwords?|credentials?|secrets?|api[\s-]?keys?|tokens?|private\s+keys?)\b/.source;

const CREDENTIAL_PATTERNS: readonly PatternRow[] = [
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`\b(?:greps?|search(?:es)?|scans?|finds?|locates?|enumerates?|collects?|gathers?)\b[^.\n]{0,60}?(?:${SECRET_STORE})`,
			'i',
		),
		message: 'matches a credential-file search phrase',
	},
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`\b(?:greps?|search(?:es)?|scans?|finds?|locates?|enumerates?|collects?|gathers?)\b(?=[^.\n]*\b(?:filesystem|file\s+system|home\s+dir(?:ectory)?|machine|disk|computer)\b)(?=[^.\n]*${SECRET_NOUN})`,
			'i',
		),
		message: 'matches a machine-wide secret-search phrase',
	},
	{
		code: 'credential-harvesting',
		// The verb has to sit where an instruction puts it (line or sentence
		// start, or after then/and/to/should/must): narrative like "timing leaks
		// secret bits" has a noun subject and does not fire. The ::/. lookbehinds
		// skip code identifiers (`Box::leak(secret)`, `.leak(`).
		pattern: new RegExp(
			String.raw`(?:^[-*\d.)\s]*|[.:;!?]\s+|\b(?:then|and|or|to|should|must|now|please)\s+)(?<!\b(?:never|not|don'?t|avoids?|prevents?|stops?)\s)(?<!::)(?<!\.)(?:exfiltrate|steal|harvest|dump|leak)s?\b[^.\n]{0,60}?${SECRET_NOUN}`,
			'i',
		),
		message: 'matches a credential-exfiltration phrase',
	},
	{
		code: 'credential-harvesting',
		pattern: new RegExp(
			String.raw`^(?=.*(?:${SECRET_STORE}))(?=.*(?<!\b(?:never|not|don'?t|avoids?|prevents?|stops?)\s)\b(?:post|send|curl|transmit|exfiltrate)s?\b)`,
			'i',
		),
		message: 'matches a credential-file network-transmission phrase',
	},
];

// Only a concrete leaked secret *value* hard-fails (republishing it would leak
// the secret). Every other content signal is advisory: it publishes and surfaces
// on the passport as "what to look out for" - a regex can't judge intent, so it
// flags for human review rather than blocking. Feature 18 (LLM review) promotes
// advisories to blocks with real judgment.
const advisory = (rows: readonly PatternRow[], mentionAware = false): PatternRow[] =>
	rows.map((row) => ({ ...row, severity: 'warning', mentionAware }));

// Security skills describe the attacks they hunt. For the two language-level
// groups, a phrase inside quotes or backticks, or one that follows detection
// language on its line, is a mention of the pattern, not an instruction to the
// agent. Commands and secrets stay strict: quoting does not make them inert.
const ALL_ROWS = [
	...SECRET_PATTERNS,
	...advisory(INJECTION_PATTERNS, true),
	...advisory(DANGEROUS_PATTERNS),
	...advisory(MALWARE_PATTERNS),
	...advisory(CREDENTIAL_PATTERNS, true),
];

const MENTION_LEAD_RE =
	/\b(?:flags?|flagged|detects?|detecting|look(?:ing)?\s+for|watch\s+for|check(?:ing)?\s+for|signs?\s+of|indicators?\s+of|evidence\s+of|red\s+flags?|examples?|e\.g\.|such\s+as|attempts?\s+to|designed\s+to|(?:code|scripts?|files?|comments?|text|instructions?)\s+that)\b/i;
const TRANSMIT_VERB_RE = /\b(?:post|send|curl|transmit|exfiltrate)s?\b/i;

// Where a lookahead-only pattern matched nothing visible, anchor on the verb it
// was looking for so the lead-in check still reads what precedes it.
function matchAnchor(line: string, match: RegExpExecArray): number {
	if (match[0]) return match.index;
	const verb = line.search(TRANSMIT_VERB_RE);
	return verb < 0 ? line.length : verb;
}

function isMention(line: string, anchor: number, inFence: boolean): boolean {
	if (inFence || line.trimStart().startsWith('|')) return true;
	const before = line.slice(0, anchor);
	const inside = (mark: string) => (before.split(mark).length - 1) % 2 === 1;
	return inside('"') || inside('`') || MENTION_LEAD_RE.test(before);
}

const FENCE_RE = /^\s*(?:```|~~~)/;

// Vendor-documented example credentials (AWS's canonical doc keys). Not secrets,
// so quoting them - as security-education skills do - must not hard-fail a
// listing. Exact literals only; stripped before matching so a real key sharing
// a line with a placeholder still fails.
const DOCUMENTED_PLACEHOLDERS = ['AKIAIOSFODNN7EXAMPLE', 'AKIAI44QH8DHBEXAMPLE'];

const withoutPlaceholders = (line: string): string =>
	DOCUMENTED_PLACEHOLDERS.reduce((l, p) => l.replaceAll(p, ' '), line);

// Redaction is per line, not per row: a non-redacting row that co-fires on a
// line with a secret must not carry the raw value into its own snippet.
const REDACTIONS = ALL_ROWS.filter((row) => row.redact).map(
	(row) => new RegExp(row.pattern.source, `${row.pattern.flags}g`),
);

const redactLine = (line: string): string => REDACTIONS.reduce((l, re) => l.replace(re, '[redacted]'), line);

export const contentRule: Rule = (pkg) => {
	const findings: RuleFinding[] = [];
	for (const file of pkg.files) {
		let inFence = false;
		file.content.split('\n').forEach((rawLine, i) => {
			if (FENCE_RE.test(rawLine)) {
				inFence = !inFence;
				return;
			}
			const line = withoutPlaceholders(rawLine);
			const hits = ALL_ROWS.filter((row) => {
				const match = row.pattern.exec(line);
				return match !== null && !(row.mentionAware && isMention(line, matchAnchor(line, match), inFence));
			});
			if (hits.length === 0) return;
			const snippet = redactLine(line).trim();
			for (const row of hits) {
				findings.push({
					severity: row.severity ?? 'failure',
					code: row.code,
					message: row.message,
					location: { path: file.path, line: i + 1, snippet },
				});
			}
		});
	}
	return findings;
};
