import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manifestSchema, PERMISSIONS } from 'skill-schema';
import { loadPackage, validatePackage } from 'validator';
import { describe, expect, it } from 'vitest';
import {
	parsePermissionAnswer,
	PLACEHOLDER_DESCRIPTION,
	renderManifest,
	renderSkillMd,
	runInit,
	yamlDescription,
} from './init';

const tempCwd = () => mkdtempSync(join(tmpdir(), 'skillpass-init-'));

// Answers prompts in order; once the script runs out every prompt gets "".
function scripted(answers: string[]) {
	const asked: string[] = [];
	const promptImpl = (question: string) => {
		asked.push(question);
		return Promise.resolve(answers.shift() ?? '');
	};
	return { promptImpl, asked };
}

describe('runInit', () => {
	it('writes a scaffold that scans clean with no prompts outside a terminal', async () => {
		const cwd = tempCwd();
		const result = await runInit('demo-skill', { cwd });
		expect(result.exitCode).toBe(0);
		expect(readdirSync(join(cwd, 'demo-skill')).sort()).toEqual(['SKILL.md', 'skill.json']);
		const report = await validatePackage(join(cwd, 'demo-skill'));
		expect(report.status).toBe('passed');
		expect(report.riskLevel).toBe('low');
		expect(report.warnings).toEqual([]);
		expect(report.failures).toEqual([]);
		expect(report.permissionsDetected).toEqual([]);
		expect(result.lines).toContain('Created demo-skill/SKILL.md');
		expect(result.lines.join('\n')).toContain('Status   PASSED');
		expect(result.lines.at(-1)).toContain('https://skillpass.dev/submit');
	});

	it('writes a manifest the strict schema accepts, with the placeholder description', async () => {
		const cwd = tempCwd();
		await runInit('demo-skill', { cwd });
		const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(cwd, 'demo-skill', 'skill.json'), 'utf8')));
		expect(manifest).toMatchObject({
			name: 'demo-skill',
			description: PLACEHOLDER_DESCRIPTION,
			version: '0.1.0',
			targets: ['claude-code', 'codex'],
			permissions: [],
		});
	});

	it('records prompted description and permissions as declared', async () => {
		const cwd = tempCwd();
		const shell = String(PERMISSIONS.findIndex((p) => p.key === 'shell.execute') + 1);
		const { promptImpl } = scripted(['Summarize PDFs for the user.', `network.fetch, ${shell} ${shell}`]);
		const result = await runInit('pdf-notes', { cwd, promptImpl });
		expect(result.exitCode).toBe(0);
		const manifest = JSON.parse(readFileSync(join(cwd, 'pdf-notes', 'skill.json'), 'utf8')) as {
			description: string;
			permissions: string[];
		};
		expect(manifest.description).toBe('Summarize PDFs for the user.');
		expect(manifest.permissions).toEqual(['shell.execute', 'network.fetch']);
		const report = await validatePackage(join(cwd, 'pdf-notes'));
		expect(report.status).toBe('passed');
		expect(report.permissionsDeclared).toEqual(manifest.permissions);
	});

	it('asks for the name when none is given and re-asks on an invalid one', async () => {
		const cwd = tempCwd();
		const { promptImpl, asked } = scripted(['My Skill', 'my-skill', '', '']);
		const result = await runInit(undefined, { cwd, promptImpl });
		expect(result.exitCode).toBe(0);
		expect(asked[1]).toContain('"My Skill" is not a valid name');
		expect(existsSync(join(cwd, 'my-skill', 'SKILL.md'))).toBe(true);
	});

	it('cancels on an empty name answer without writing anything', async () => {
		const cwd = tempCwd();
		const result = await runInit(undefined, { cwd, promptImpl: scripted([]).promptImpl });
		expect(result).toEqual({ lines: ['init cancelled; nothing was written'], exitCode: 2 });
		expect(readdirSync(cwd)).toEqual([]);
	});

	it('re-asks on a permission token that is not on the list', async () => {
		const cwd = tempCwd();
		const { promptImpl, asked } = scripted(['', 'shell', 'shell.execute']);
		await runInit('demo-skill', { cwd, promptImpl });
		expect(asked[2]).toContain('"shell" is not on the list');
		const manifest = JSON.parse(readFileSync(join(cwd, 'demo-skill', 'skill.json'), 'utf8')) as {
			permissions: string[];
		};
		expect(manifest.permissions).toEqual(['shell.execute']);
	});

	it('needs a name outside a terminal', async () => {
		const result = await runInit(undefined, { cwd: tempCwd() });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('skillpass init <name>');
	});

	it('rejects an invalid name argument before writing', async () => {
		const cwd = tempCwd();
		const result = await runInit('My_Skill', { cwd });
		expect(result.exitCode).toBe(2);
		expect(readdirSync(cwd)).toEqual([]);
	});

	it('refuses an existing target and leaves it untouched', async () => {
		const cwd = tempCwd();
		mkdirSync(join(cwd, 'demo-skill'));
		const { promptImpl, asked } = scripted([]);
		const result = await runInit('demo-skill', { cwd, promptImpl });
		expect(result.exitCode).toBe(2);
		expect(result.lines[0]).toContain('already exists');
		expect(asked).toEqual([]);
		expect(readdirSync(join(cwd, 'demo-skill'))).toEqual([]);
	});
});

describe('yamlDescription', () => {
	it('keeps a simple description as a plain scalar', () => {
		expect(yamlDescription('Summarize PDFs for the user.')).toBe('description: Summarize PDFs for the user.');
	});

	it.each(['Use when: the user asks', 'Tag #1 helper', 'Say "hi" politely', "It's handy", 'yes', '2 steps'])(
		'folds %j so the validator reads it back unchanged from SKILL.md',
		(text) => {
			expect(yamlDescription(text)).toBe(`description: >-\n  ${text}`);
			const dir = join(tempCwd(), 'skill');
			mkdirSync(dir);
			// SKILL.md alone, so the validator infers the manifest from the frontmatter.
			writeFileSync(join(dir, 'SKILL.md'), renderSkillMd({ name: 'skill', description: text, permissions: [] }));
			const pkg = loadPackage(dir);
			expect(pkg.manifest.state === 'ok' && pkg.manifest.data.description).toBe(text);
		},
	);

	it('reads a plain description back unchanged too', () => {
		const dir = join(tempCwd(), 'skill');
		mkdirSync(dir);
		writeFileSync(
			join(dir, 'SKILL.md'),
			renderSkillMd({ name: 'skill', description: 'Summarize PDFs.', permissions: [] }),
		);
		writeFileSync(
			join(dir, 'skill.json'),
			renderManifest({ name: 'skill', description: 'Summarize PDFs.', permissions: [] }),
		);
		expect(readFileSync(join(dir, 'SKILL.md'), 'utf8')).toContain('\ndescription: Summarize PDFs.\n');
	});
});

describe('parsePermissionAnswer', () => {
	it('accepts numbers and keys in any order and returns taxonomy order', () => {
		expect(parsePermissionAnswer(`network.fetch, 1`)).toEqual({
			ok: true,
			keys: [PERMISSIONS[0].key, 'network.fetch'],
		});
	});

	it('treats an empty answer as none', () => {
		expect(parsePermissionAnswer('  ')).toEqual({ ok: true, keys: [] });
	});

	it('names the first unknown token', () => {
		expect(parsePermissionAnswer('1, 0, nope')).toEqual({ ok: false, token: '0' });
		expect(parsePermissionAnswer(String(PERMISSIONS.length + 1))).toEqual({
			ok: false,
			token: String(PERMISSIONS.length + 1),
		});
	});
});
