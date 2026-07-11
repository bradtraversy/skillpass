import { Hono } from 'hono';
import { parseResolveReportInput, type AdminAbuseReport, type AdminQueue } from 'skill-schema';
import { requireAuth, requireRole, type AuthVariables } from '../auth/middleware';
import {
	adminAbuseReport,
	findAdminReportById,
	listOpenAbuseReports,
	setAbuseReportStatus,
} from '../db/abuse';
import type { Db } from '../db/client';
import {
	adminSkillRef,
	findSkillBySlug,
	listFlaggedSkills,
	listSkillValidationHistory,
	setSkillStatus,
} from '../db/skills';
import { adminSubmission, listFailedSubmissions } from '../db/submissions';
import type { Env } from '../env';
import { awardReputation } from '../reputation/reputation';

// Admin-only surfaces: the holding queue and review actions. Every route sits
// behind requireAuth (401 for anon) then requireRole (403 for non-admin).
export function adminRoutes(env: Env, db: Db) {
	const routes = new Hono<{ Variables: AuthVariables }>();
	routes.use('*', requireAuth(env, db));
	routes.use('*', requireRole('admin'));

	routes.get('/queue', async (c) => {
		const [reports, failedSubmissions, flaggedSkills] = await Promise.all([
			listOpenAbuseReports(db),
			listFailedSubmissions(db),
			listFlaggedSkills(db),
		]);
		const data: AdminQueue = {
			reports: reports.map(adminAbuseReport),
			failedSubmissions: failedSubmissions.map(adminSubmission),
			flaggedSkills: flaggedSkills.map(adminSkillRef),
		};
		return c.json({ success: true, data });
	});

	// Resolve a report: 'reviewed' dismisses it, 'actioned' upholds it and docks
	// the skill maintainer's reputation. Only an open report resolves, so the
	// dock can never fire twice for the same report.
	routes.post('/reports/:id/resolve', async (c) => {
		const id = Number(c.req.param('id'));
		if (!Number.isInteger(id)) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json({ success: false, error: 'send a JSON body with a status' }, 400);
		}
		const parsed = parseResolveReportInput(body);
		if (!parsed.success) {
			return c.json({ success: false, error: parsed.error }, 400);
		}

		const record = await findAdminReportById(db, id);
		if (!record) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		if (record.report.status !== 'open') {
			return c.json({ success: false, error: 'this report has already been resolved' }, 409);
		}

		// Award before flipping the status: a dock failure then leaves the report
		// open and retryable, never actioned-with-no-consequence.
		if (parsed.data.status === 'actioned') {
			await awardReputation(db, record.skill.maintainerId, 'report_actioned');
		}
		await setAbuseReportStatus(db, id, parsed.data.status);

		const data: AdminAbuseReport = adminAbuseReport({
			...record,
			report: { ...record.report, status: parsed.data.status },
		});
		return c.json({ success: true, data });
	});

	// Flag hides a published skill from the public directory; unflag restores it.
	// Guards the exact transition so the state can't be corrupted.
	routes.post('/skills/:slug/flag', async (c) => {
		const slug = c.req.param('slug');
		const skill = await findSkillBySlug(db, slug);
		if (!skill) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		if (skill.status !== 'published') {
			return c.json({ success: false, error: 'only a published skill can be flagged' }, 409);
		}
		await setSkillStatus(db, skill.id, 'flagged');
		return c.json({ success: true, data: { slug, status: 'flagged' } });
	});

	routes.post('/skills/:slug/unflag', async (c) => {
		const slug = c.req.param('slug');
		const skill = await findSkillBySlug(db, slug);
		if (!skill) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		if (skill.status !== 'flagged') {
			return c.json({ success: false, error: 'only a flagged skill can be unflagged' }, 409);
		}
		await setSkillStatus(db, skill.id, 'published');
		return c.json({ success: true, data: { slug, status: 'published' } });
	});

	// Every version's validation verdict + findings for one skill; the by-slug
	// lookup includes flagged skills, unlike the public-only helpers.
	routes.get('/skills/:slug/history', async (c) => {
		const skill = await findSkillBySlug(db, c.req.param('slug'));
		if (!skill) {
			return c.json({ success: false, error: 'not found' }, 404);
		}
		const history = await listSkillValidationHistory(db, skill.id);
		return c.json({ success: true, data: history });
	});

	return routes;
}
