import { z } from 'zod';
import { targetSchema, type Target } from './enums';
import { permissionKeySchema } from './permissions';
import { parseWith, type ParseResult } from './result';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const slugSchema = z.string().regex(SLUG_RE, 'must be a kebab-case slug');

export const DISTRIBUTIONS = ['skill', 'cli', 'system'] as const;
export const distributionSchema = z.enum(DISTRIBUTIONS);
export type Distribution = z.infer<typeof distributionSchema>;

const relativePathSchema = z
	.string()
	.min(1)
	.refine((p) => !p.startsWith('/'), 'must be a relative path')
	.refine((p) => !p.split('/').includes('..'), 'must not contain .. segments');

export const skillEntrySchema = z.strictObject({
	name: slugSchema,
	description: z.string().optional(),
	entry: relativePathSchema,
	targets: z.array(targetSchema).min(1).optional(),
	permissions: z.array(permissionKeySchema).optional(),
	variants: z.partialRecord(targetSchema, relativePathSchema).optional(),
});

export const manifestSchema = z
	.strictObject({
		schemaVersion: z.literal('0.1'),
		name: slugSchema,
		description: z.string().min(1),
		version: z.string().regex(SEMVER_RE, 'must be a semver version').optional(),
		targets: z.array(targetSchema).min(1),
		permissions: z.array(permissionKeySchema),
		// How the listing is obtained: download the validated snapshot (default),
		// a CLI installed via `install`, or a system/framework fetched from its repo.
		distribution: distributionSchema.default('skill'),
		homepage: z.url().optional(),
		install: z.string().min(1).optional(),
		skills: z.array(skillEntrySchema).min(1).optional(),
	})
	.superRefine((manifest, ctx) => {
		const seen = new Set<string>();
		(manifest.skills ?? []).forEach((entry, i) => {
			if (seen.has(entry.name)) {
				ctx.addIssue({
					code: 'custom',
					path: ['skills', i, 'name'],
					message: `duplicate skill entry name "${entry.name}"`,
				});
			}
			seen.add(entry.name);

			for (const target of entry.targets ?? []) {
				if (!manifest.targets.includes(target)) {
					ctx.addIssue({
						code: 'custom',
						path: ['skills', i, 'targets'],
						message: `target "${target}" is not declared by the package`,
					});
				}
			}

			for (const permission of entry.permissions ?? []) {
				if (!manifest.permissions.includes(permission)) {
					ctx.addIssue({
						code: 'custom',
						path: ['skills', i, 'permissions'],
						message: `permission "${permission}" is not declared by the package`,
					});
				}
			}

			// A variant maps a target to its entry path, so it only makes sense
			// for a target the skill actually supports.
			const effectiveTargets = entry.targets ?? manifest.targets;
			for (const target of Object.keys(entry.variants ?? {}) as Target[]) {
				if (!effectiveTargets.includes(target)) {
					ctx.addIssue({
						code: 'custom',
						path: ['skills', i, 'variants'],
						message: `variant target "${target}" is not among the skill's targets`,
					});
				}
			}
		});
	});

export type SkillEntry = z.infer<typeof skillEntrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(input: unknown): ParseResult<Manifest> {
	return parseWith(manifestSchema, input);
}
