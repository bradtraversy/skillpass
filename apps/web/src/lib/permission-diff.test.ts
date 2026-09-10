import { describe, expect, it } from 'vitest';
import { changedPermissions } from './permission-diff';

describe('changedPermissions', () => {
	it('merges declared and detected changes and names each key once', () => {
		expect(
			changedPermissions({
				previousVersion: '1.0.0',
				declared: { added: ['network.fetch', 'env.read'], removed: ['shell.execute'] },
				detected: { added: ['network.fetch'], removed: ['shell.execute', 'env.read'] },
			}),
		).toEqual({ added: ['network.fetch', 'env.read'], removed: ['shell.execute', 'env.read'] });
	});

	it('is empty when nothing changed', () => {
		expect(
			changedPermissions({
				previousVersion: '1.0.0',
				declared: { added: [], removed: [] },
				detected: { added: [], removed: [] },
			}),
		).toEqual({ added: [], removed: [] });
	});
});
