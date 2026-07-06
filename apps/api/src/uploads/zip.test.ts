import { strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, MAX_FILES } from '../github/snapshot';
import { extractZip } from './zip';

const makeZip = (entries: Record<string, string>): Uint8Array => {
	const zippable: Zippable = {};
	for (const [name, content] of Object.entries(entries)) {
		zippable[name] = strToU8(content);
	}
	return zipSync(zippable);
};

describe('extractZip', () => {
	it('strips a shared root and returns sorted utf8 files', () => {
		const zip = makeZip({
			'my-skill-main/skill.json': '{"name":"demo"}',
			'my-skill-main/SKILL.md': '# Demo\n',
			'my-skill-main/docs/notes.md': 'notes',
		});
		expect(extractZip(zip)).toEqual({
			success: true,
			data: [
				{ path: 'SKILL.md', content: '# Demo\n' },
				{ path: 'docs/notes.md', content: 'notes' },
				{ path: 'skill.json', content: '{"name":"demo"}' },
			],
		});
	});

	it('keeps paths as-is when there is no shared root', () => {
		const zip = makeZip({ 'SKILL.md': '# Demo', 'docs/notes.md': 'notes' });
		const result = extractZip(zip);
		expect(result).toEqual({
			success: true,
			data: [
				{ path: 'SKILL.md', content: '# Demo' },
				{ path: 'docs/notes.md', content: 'notes' },
			],
		});
	});

	it('skips directory entries', () => {
		const zip = zipSync({ 'skill/': new Uint8Array(0), 'skill/SKILL.md': strToU8('# Hi') });
		expect(extractZip(zip)).toEqual({
			success: true,
			data: [{ path: 'SKILL.md', content: '# Hi' }],
		});
	});

	it.each([
		['a traversal segment', '../evil.md'],
		['a nested traversal', 'ok/../../evil.md'],
		['a backslash path', 'a\\b.md'],
		['an absolute path', '/etc/passwd'],
		['a dot segment', './SKILL.md'],
	])('rejects %s', (_label, name) => {
		const zip = makeZip({ [name]: 'x', 'SKILL.md': 'ok' });
		expect(extractZip(zip)).toMatchObject({ success: false, code: 'bad-archive' });
	});

	it('rejects a file over the per-file cap from its declared size', () => {
		const zip = makeZip({ 'big.md': 'a'.repeat(MAX_FILE_BYTES + 1) });
		expect(extractZip(zip)).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects a package over the file-count cap', () => {
		const entries: Record<string, string> = {};
		for (let i = 0; i <= MAX_FILES; i++) entries[`f${i}.md`] = 'x';
		expect(extractZip(makeZip(entries))).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects a package over the total-bytes cap', () => {
		const entries: Record<string, string> = {};
		for (let i = 0; i < 11; i++) entries[`f${i}.md`] = 'a'.repeat(MAX_FILE_BYTES);
		expect(extractZip(makeZip(entries))).toMatchObject({ success: false, code: 'too-large' });
	});

	it('rejects an empty zip', () => {
		expect(extractZip(zipSync({ 'dir/': new Uint8Array(0) }))).toMatchObject({
			success: false,
			code: 'empty-package',
		});
	});

	it('rejects a corrupt buffer', () => {
		expect(extractZip(strToU8('definitely not a zip'))).toMatchObject({
			success: false,
			code: 'bad-archive',
		});
	});
});
