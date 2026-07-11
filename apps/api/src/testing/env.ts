// Valid-by-construction env source for tests; spread and override per case.
export const RAW_TEST_ENV = {
	DATABASE_URL: 'postgres://unused',
	GITHUB_CLIENT_ID: 'client-id',
	GITHUB_CLIENT_SECRET: 'client-secret',
	SESSION_SECRET: 's'.repeat(32),
	R2_ACCOUNT_ID: 'acct',
	R2_ACCESS_KEY_ID: 'r2-key',
	R2_SECRET_ACCESS_KEY: 'r2-secret',
	R2_BUCKET: 'test-bucket',
	REDIS_URL: 'redis://localhost:6379',
	// Tests exercise the queue path by default; inline cases override this.
	VALIDATION_MODE: 'queue',
};
