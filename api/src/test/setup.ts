// Ensure required env vars exist for modules that import `env` at module-load time.
// Tests must not rely on real secrets or developer machine configuration.
process.env.NODE_ENV ||= "test";
process.env.AWS_REGION ||= "us-east-1";
process.env.COGNITO_USER_POOL_ID ||= "test_pool";
process.env.COGNITO_APP_CLIENT_ID ||= "test_client";
process.env.COGNITO_APP_CLIENT_SECRET ||= "";
process.env.DATABASE_URL ||= "postgresql://user:pass@localhost:5432/test";
