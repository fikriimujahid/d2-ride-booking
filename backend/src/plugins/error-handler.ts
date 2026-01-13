import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { isAppError } from '../shared/errors.js';
import { env } from '../config/env.js';

function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) return error.statusCode;
  if (typeof error === 'object' && error !== null) {
    const maybe = (error as { statusCode?: unknown }).statusCode;
    if (typeof maybe === 'number' && Number.isInteger(maybe) && maybe >= 400 && maybe <= 599) {
      return maybe;
    }
  }
  return 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export const errorHandlerPlugin: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    const isKnown = isAppError(error);

    const statusCode = getErrorStatusCode(error);

    const code = isKnown ? error.code : 'INTERNAL_ERROR';

    if (env.nodeEnv !== 'test') {
      app.log.error({ err: error }, 'request error');
    }

    const message =
      statusCode >= 500 && env.nodeEnv === 'production' ? 'Internal Server Error' : getErrorMessage(error);

    void reply.status(statusCode).send({
      error: {
        code,
        message
      }
    });
  });
});
