import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPackage, type LoadedPackage } from '../load';
import { structureRule } from './structure';

const fixture = (name: string) => join(import.meta.dirname, '..', '..', 'fixtures', name);

function pkg(overrides: Partial<LoadedPackage> = {}): LoadedPackage {
	return {
		files: [{ path: 'SKILL.md', content: '# fake\n\nDo something helpful.\n' }],
		manifest: { state: 'missing' },
		entries: [{ skillName: 'fake', path: 'SKILL.md', exists: true }],
		sourceHash: 'sha256:0',
		...overrides,
	};
}

describe('structureRule', () => {
	it('reports nothing for a complete package', () => {
		expect(structureRule(loadPackage(fixture('clean-skill')))).toEqual([]);
	});

	it('reports nothing for the missing-manifest fixture (its manifest is inferred)', () => {
		expect(structureRule(loadPackage(fixture('missing-manifest')))).toEqual([]);
	});

	it('warns when a manifest is genuinely missing (no SKILL.md to infer from)', () => {
		const findings = structureRule(pkg());
		expect(findings).toContainEqual(
			expect.objectContaining({ severity: 'warning', code: 'missing-manifest' }),
		);
	});

	it('fails on the broken-manifest fixture', () => {
		const findings = structureRule(loadPackage(fixture('broken-manifest')));
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({ severity: 'failure', code: 'invalid-manifest' });
	});

	it('fails a schema-invalid manifest, not just broken JSON', () => {
		const findings = structureRule(
			pkg({ manifest: { state: 'invalid', error: 'targets: must not be empty' } }),
		);
		expect(findings[0]).toMatchObject({ severity: 'failure', code: 'invalid-manifest' });
		expect(findings[0].message).toContain('targets');
	});

	it('fails an entry that does not exist', () => {
		const findings = structureRule(
			pkg({ entries: [{ skillName: 'fake', path: 'missing/SKILL.md', exists: false }] }),
		);
		expect(findings).toContainEqual(
			expect.objectContaining({
				severity: 'failure',
				code: 'missing-skill-file',
				location: { path: 'missing/SKILL.md' },
			}),
		);
	});

	it('fails an entry whose file is empty', () => {
		const findings = structureRule(
			pkg({ files: [{ path: 'SKILL.md', content: '  \n' }] }),
		);
		expect(findings).toContainEqual(
			expect.objectContaining({ severity: 'failure', code: 'missing-skill-file' }),
		);
	});

	it('reports only empty-package for an empty directory', () => {
		const findings = structureRule(pkg({ files: [], entries: [] }));
		expect(findings).toEqual([
			expect.objectContaining({ severity: 'failure', code: 'empty-package' }),
		]);
	});
});
