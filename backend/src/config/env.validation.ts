import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),

  // Comma-separated list, e.g. "http://localhost:5173,https://admin.example.com"
  CORS_ORIGINS: Joi.string().allow('').default(''),

  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100)
});
