import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { routes } from './routes/index.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware.js';
import { ApiError } from './models/error.model.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(requestLoggerMiddleware);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Swagger/OpenAPI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const openApiPath = path.resolve(__dirname, '..', 'docs', 'openapi.yaml');

function readOpenApiYaml(): string {
  return fs.readFileSync(openApiPath, 'utf8');
}

app.get('/openapi.yaml', (_req, res) => {
	try {
		const openApiYaml = readOpenApiYaml();
		res.setHeader('Cache-Control', 'no-store');
		res.type('text/yaml').send(openApiYaml);
	} catch {
		res.status(500).json({ error: 'OPENAPI_LOAD_FAILED' });
	}
});

// Point Swagger UI at the /openapi.yaml endpoint so edits show without restarting.
app.use(
	'/docs',
	swaggerUi.serve,
	swaggerUi.setup(undefined, {
		swaggerOptions: {
			url: '/openapi.yaml'
		}
	})
);

app.use('/api/v1', routes);

// Not found (JSON only)
app.use((_req, _res, next) => {
	next(
		new ApiError({
			status: 404,
			code: 'NOT_FOUND',
			message: 'The requested resource was not found.'
		})
	);
});

app.use(errorMiddleware);
