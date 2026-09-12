import { z } from 'zod';

export const PERMISSION_KEYS = [
	'filesystem.read.project',
	'filesystem.read.home',
	'filesystem.write.project',
	'filesystem.write.home',
	'env.read',
	'shell.suggest',
	'shell.execute',
	'network.fetch',
	'network.post',
	'connector.github.read',
	'connector.github.write',
	'connector.gmail.read',
	'connector.gmail.send',
	'connector.calendar.read',
	'connector.calendar.write',
	'external.publish',
	'external.deploy',
	'external.payment',
	'destructive.delete',
] as const;

export const permissionKeySchema = z.enum(PERMISSION_KEYS);

export type PermissionKey = z.infer<typeof permissionKeySchema>;
export type PermissionGroup = PermissionKey extends `${infer G}.${string}` ? G : never;

export interface PermissionDefinition {
	key: PermissionKey;
	label: string;
	description: string;
	riskWeight: number;
}

// Weights are 1-10, relative risk of granting the permission to an agent.
// Read-only access stays low; exfiltration channels and irreversible or
// outward-facing actions sit at the top. The validator (feature 4) turns
// these into a riskLevel; this package only declares them.
const definitions: Record<PermissionKey, Omit<PermissionDefinition, 'key'>> = {
	'filesystem.read.project': {
		label: 'Read project files',
		description: 'Read files inside the current project or workspace.',
		riskWeight: 1,
	},
	'filesystem.read.home': {
		label: 'Read home directory',
		description: 'Read files outside the project, including dotfiles and configs.',
		riskWeight: 4,
	},
	'filesystem.write.project': {
		label: 'Write project files',
		description: 'Create or modify files inside the current project or workspace.',
		riskWeight: 3,
	},
	'filesystem.write.home': {
		label: 'Write home directory',
		description: 'Create or modify files outside the project.',
		riskWeight: 6,
	},
	'env.read': {
		label: 'Read environment variables',
		description: 'Read environment variables, which often hold secrets and tokens.',
		riskWeight: 5,
	},
	'shell.suggest': {
		label: 'Suggest shell commands',
		description: 'Propose shell commands for the user to review and run.',
		riskWeight: 2,
	},
	'shell.execute': {
		label: 'Execute shell commands',
		description: 'Run shell commands directly through the agent.',
		riskWeight: 7,
	},
	'network.fetch': {
		label: 'Fetch from the network',
		description: 'Make outbound HTTP requests to read remote data.',
		riskWeight: 3,
	},
	'network.post': {
		label: 'Send data over the network',
		description: 'Transmit data to external services, a potential exfiltration channel.',
		riskWeight: 5,
	},
	'connector.github.read': {
		label: 'Read GitHub',
		description: 'Read repositories, issues, and pull requests via a GitHub connector.',
		riskWeight: 2,
	},
	'connector.github.write': {
		label: 'Write to GitHub',
		description: 'Push commits, open pull requests, or modify repositories.',
		riskWeight: 6,
	},
	'connector.gmail.read': {
		label: 'Read email',
		description: 'Read messages through a mail connector.',
		riskWeight: 5,
	},
	'connector.gmail.send': {
		label: 'Send email',
		description: "Send messages on the user's behalf.",
		riskWeight: 8,
	},
	'connector.calendar.read': {
		label: 'Read calendar',
		description: 'Read events through a calendar connector.',
		riskWeight: 2,
	},
	'connector.calendar.write': {
		label: 'Write calendar',
		description: 'Create or modify calendar events.',
		riskWeight: 4,
	},
	'external.publish': {
		label: 'Publish externally',
		description: 'Post or publish content to an outside audience.',
		riskWeight: 8,
	},
	'external.deploy': {
		label: 'Deploy',
		description: 'Trigger deployments to live environments.',
		riskWeight: 8,
	},
	'external.payment': {
		label: 'Make payments',
		description: 'Initiate charges or move money.',
		riskWeight: 9,
	},
	'destructive.delete': {
		label: 'Delete destructively',
		description: 'Irreversibly delete files, resources, or data.',
		riskWeight: 9,
	},
};

export const PERMISSIONS: readonly PermissionDefinition[] = PERMISSION_KEYS.map((key) => ({
	key,
	...definitions[key],
}));

export function permissionGroup(key: PermissionKey): PermissionGroup {
	return key.slice(0, key.indexOf('.')) as PermissionGroup;
}

export function riskWeightOf(key: PermissionKey): number {
	return definitions[key].riskWeight;
}
