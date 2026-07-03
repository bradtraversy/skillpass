import type { ReportFinding } from 'skill-schema';
import type { LoadedPackage } from '../load';

export interface RuleFinding extends ReportFinding {
	severity: 'warning' | 'failure';
}

export type Rule = (pkg: LoadedPackage) => RuleFinding[];
