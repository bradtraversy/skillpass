import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { REPUTATION_INPUT_TYPES } from '../db/schema';
import { awardReputation, REPUTATION_WEIGHTS } from './reputation';

function fakeDb() {
	const inserted: unknown[] = [];
	const updated: unknown[] = [];
	const db = {
		insert: () => ({
			values: async (v: unknown) => {
				inserted.push(v);
			},
		}),
		update: () => ({
			set: (v: unknown) => ({
				where: async () => {
					updated.push(v);
				},
			}),
		}),
	} as unknown as Db;
	return { db, inserted, updated };
}

describe('awardReputation', () => {
	it('writes the ledger row with the weight of the moment and bumps the roll-up', async () => {
		const { db, inserted, updated } = fakeDb();
		await awardReputation(db, 7, 'report_actioned');
		expect(inserted).toEqual([{ userId: 7, type: 'report_actioned', weight: -25 }]);
		expect(updated).toHaveLength(1);
	});

	it('has a weight for every input type the database accepts', () => {
		expect(Object.keys(REPUTATION_WEIGHTS).sort()).toEqual([...REPUTATION_INPUT_TYPES].sort());
	});
});
