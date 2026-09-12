import { z } from 'zod';

export type Result<T> = { success: true; data: T } | { success: false; error: string };

// The parse helpers' return type; the same shape the API uses for its outcomes.
export type ParseResult<T> = Result<T>;

export function parseWith<Schema extends z.ZodType>(schema: Schema, input: unknown): ParseResult<z.infer<Schema>> {
	const result = schema.safeParse(input);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: z.prettifyError(result.error) };
}
