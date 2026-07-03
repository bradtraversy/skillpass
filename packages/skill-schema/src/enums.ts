import { z } from 'zod';

export const VALIDATION_STATUSES = ['passed', 'warning', 'failed'] as const;
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export const TARGETS = ['codex', 'claude-code', 'cursor', 'cowork', 'aider'] as const;
export const SOURCE_TYPES = ['github', 'zip'] as const;

export const validationStatusSchema = z.enum(VALIDATION_STATUSES);
export const riskLevelSchema = z.enum(RISK_LEVELS);
export const targetSchema = z.enum(TARGETS);
export const sourceTypeSchema = z.enum(SOURCE_TYPES);

export type ValidationStatus = z.infer<typeof validationStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type Target = z.infer<typeof targetSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
