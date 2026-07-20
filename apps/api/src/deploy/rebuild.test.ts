import { describe, expect, it, vi } from 'vitest';
import { triggerRebuild } from './rebuild';

const okResponse = { ok: true, status: 200 } as Response;

describe('triggerRebuild', () => {
	it('does nothing when no hook URL is configured', async () => {
		const fetchImpl = vi.fn();
		expect(await triggerRebuild(undefined, fetchImpl)).toBe(false);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('POSTs to the hook URL when configured', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(okResponse);
		expect(await triggerRebuild('https://hook.example/deploy', fetchImpl)).toBe(true);
		expect(fetchImpl).toHaveBeenCalledWith('https://hook.example/deploy', { method: 'POST' });
	});

	it('returns false on a non-ok response without throwing', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
		expect(await triggerRebuild('https://hook.example/deploy', fetchImpl)).toBe(false);
	});

	it('swallows a fetch error so publish never fails', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
		expect(await triggerRebuild('https://hook.example/deploy', fetchImpl)).toBe(false);
	});
});
