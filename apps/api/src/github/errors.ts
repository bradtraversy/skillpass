export type SourceErrorCode =
	| 'bad-url'
	| 'not-found'
	| 'rate-limited'
	| 'upstream'
	| 'bad-archive'
	| 'too-large'
	| 'empty-package';

export type SourceResult<T> =
	| { success: true; data: T }
	| { success: false; code: SourceErrorCode; error: string };

export function sourceError(code: SourceErrorCode, error: string): SourceResult<never> {
	return { success: false, code, error };
}
