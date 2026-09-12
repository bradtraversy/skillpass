import { describe, expect, it } from 'vitest';
import { declaredVersionFor, planRename } from './backfill-versions';

describe('declaredVersionFor', () => {
	it('reads the agentskills.io metadata version from a snapshot', () => {
		const files = [
			{
				path: 'SKILL.md',
				content:
					'---\nname: ai-slop-detection\ndescription: "Check the project."\nlicense: Apache-2.0\nmetadata:\n  author: kometolabs\n  version: "1.4.0"\n---\n\nCheck the project.\n',
			},
		];
		expect(declaredVersionFor(files, 'ai-slop-detection')).toBe('1.4.0');
	});

	it('returns nothing for a skill that declares no version', () => {
		expect(declaredVersionFor([{ path: 'SKILL.md', content: '---\nname: x\n---\n# x\n' }], 'x')).toBeUndefined();
	});
});

describe('planRename', () => {
	it('keeps the counter number when nothing is declared', () => {
		expect(planRename('1.0.0', undefined, [])).toEqual({ action: 'skip', reason: 'declares no version' });
	});

	it('leaves a matching version alone', () => {
		expect(planRename('1.4.0', '1.4.0', [])).toEqual({ action: 'skip', reason: 'already matches' });
	});

	it('renames to the declared version', () => {
		expect(planRename('1.0.0', '1.4.0', [])).toEqual({ action: 'rename', to: '1.4.0' });
	});

	it('refuses a declared version another row of the skill already holds', () => {
		expect(planRename('2.0.0', '1.4.0', ['1.0.0', '1.4.0'])).toEqual({
			action: 'skip',
			reason: '1.4.0 already exists for this skill',
		});
	});
});
