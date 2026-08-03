import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSkillBySlug } from '../db/skills';
import { createSubmission } from '../db/submissions';
import { createValidationJob, findValidationReportForSubmission } from '../db/validation';
import { resolveCommit } from '../github/pin';
import { fetchSnapshot } from '../github/snapshot';
import { parseGithubUrl } from '../github/url';
import { publishSubmission } from '../publish/publish';
import { processValidationJob } from '../queue/processor';
import { putJson, snapshotDocument, snapshotKey } from '../storage/r2';
import { loadPackageFromFiles } from 'validator';
import { curateSkill } from './curate';

vi.mock('../github/url');
vi.mock('../github/pin');
vi.mock('../github/snapshot');
vi.mock('../db/skills');
vi.mock('../db/submissions');
vi.mock('../db/validation');
vi.mock('../queue/processor');
vi.mock('../publish/publish');
vi.mock('../storage/r2');
vi.mock('validator');

const env = {} as never;
const db = {} as never;
const input = { githubUrl: 'https://github.com/anthropics/skills/tree/main/skills/pdf', ownerUserId: 7, attributedTo: 'anthropics' };

// A passed pipeline: real slugForSkill runs on this name -> slug "pdf-tools".
function happyPath() {
	vi.mocked(parseGithubUrl).mockReturnValue({
		success: true,
		data: { owner: 'anthropics', repo: 'skills', ref: 'main', subpath: 'skills/pdf' },
	});
	vi.mocked(resolveCommit).mockResolvedValue({ success: true, data: 'sha123' });
	vi.mocked(fetchSnapshot).mockResolvedValue({
		success: true,
		data: [{ path: 'SKILL.md', content: '# PDF' }],
	});
	vi.mocked(loadPackageFromFiles).mockReturnValue({
		manifest: {
			state: 'ok',
			inferred: false,
			data: { name: 'PDF Tools', description: 'Work with PDFs', targets: ['claude-code'] },
		},
		files: [{ path: 'SKILL.md', content: '# PDF' }],
		sourceHash: 'hash123',
	} as unknown as ReturnType<typeof loadPackageFromFiles>);
	vi.mocked(snapshotKey).mockReturnValue('snapshots/hash123.json');
	vi.mocked(snapshotDocument).mockReturnValue({ files: [] } as never);
	vi.mocked(putJson).mockResolvedValue({ success: true, data: null });
	vi.mocked(findSkillBySlug).mockResolvedValue(undefined);
	vi.mocked(createSubmission).mockResolvedValue({ id: 1, userId: 7 } as never);
	vi.mocked(createValidationJob).mockResolvedValue({ id: 1 } as never);
	vi.mocked(processValidationJob).mockResolvedValue(undefined);
	vi.mocked(findValidationReportForSubmission).mockResolvedValue({ status: 'passed' } as never);
	vi.mocked(publishSubmission).mockResolvedValue({ success: true, data: { slug: 'pdf-tools', version: '1.0.0' } });
}

beforeEach(() => {
	vi.resetAllMocks();
	happyPath();
});

describe('curateSkill', () => {
	it('publishes a passing new source', async () => {
		const result = await curateSkill(env, db, input);
		expect(result).toEqual({ slug: 'pdf-tools', status: 'published' });
		expect(publishSubmission).toHaveBeenCalledOnce();
	});

	it('a name override drives both the slug and the published name', async () => {
		const result = await curateSkill(env, db, { ...input, name: 'knowledge-work-sales' });
		expect(result).toEqual({ slug: 'knowledge-work-sales', status: 'published' });
		expect(publishSubmission).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ name: 'knowledge-work-sales' }),
		);
	});

	it('skips when the slug already exists, without submitting or publishing', async () => {
		vi.mocked(findSkillBySlug).mockResolvedValue({ id: 9, slug: 'pdf-tools' } as never);
		const result = await curateSkill(env, db, input);
		expect(result).toEqual({ slug: 'pdf-tools', status: 'skipped' });
		expect(createSubmission).not.toHaveBeenCalled();
		expect(publishSubmission).not.toHaveBeenCalled();
	});

	it('fails without publishing when validation failed', async () => {
		vi.mocked(findValidationReportForSubmission).mockResolvedValue({ status: 'failed' } as never);
		const result = await curateSkill(env, db, input);
		expect(result.status).toBe('failed');
		expect(result.reason).toContain('failed');
		expect(publishSubmission).not.toHaveBeenCalled();
	});

	it('publishes a warning source (warnings surface in the passport, not blocked)', async () => {
		vi.mocked(findValidationReportForSubmission).mockResolvedValue({ status: 'warning' } as never);
		const result = await curateSkill(env, db, input);
		expect(result).toEqual({ slug: 'pdf-tools', status: 'published' });
		expect(publishSubmission).toHaveBeenCalledOnce();
	});

	it('catches a thrown pipeline error as a failed result', async () => {
		vi.mocked(resolveCommit).mockRejectedValue(new Error('github exploded'));
		const result = await curateSkill(env, db, input);
		expect(result.status).toBe('failed');
		expect(result.reason).toBe('github exploded');
		expect(publishSubmission).not.toHaveBeenCalled();
	});

	it('fails on a source error (bad url) without throwing', async () => {
		vi.mocked(parseGithubUrl).mockReturnValue({ success: false, code: 'bad-url', error: 'nope' });
		const result = await curateSkill(env, db, input);
		expect(result).toEqual({ slug: null, status: 'failed', reason: 'nope' });
	});
});
