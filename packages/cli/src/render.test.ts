import { describe, expect, it } from 'vitest';
import { findingLine, permissionLine, renderFindings, renderPermissions } from './render';

describe('permissionLine', () => {
	it('adds the taxonomy label', () => {
		expect(permissionLine('network.fetch')).toBe('network.fetch - Fetch from the network');
	});
});

describe('findingLine', () => {
	it('includes path and line when present', () => {
		expect(
			findingLine({
				code: 'SECRET_LEAKED',
				message: 'looks like a credential',
				location: { path: 'skill.json', line: 3 },
			}),
		).toBe('  SECRET_LEAKED [skill.json:3] looks like a credential');
	});

	it('omits the location bracket when absent', () => {
		expect(findingLine({ code: 'X', message: 'no location' })).toBe('  X no location');
	});
});

describe('renderFindings', () => {
	it('is empty for no findings', () => {
		expect(renderFindings('Failures', [])).toEqual([]);
	});
});

describe('renderPermissions', () => {
	it('marks empty sets as none', () => {
		const lines = renderPermissions([], ['env.read']);
		expect(lines).toContain('    (none)');
		expect(lines.join('\n')).toContain('env.read - ');
	});
});
