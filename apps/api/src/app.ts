import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { formatIssues, UnbalancedEntryError } from '@ledgerline/shared';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import { attachUser } from './auth/guards';
import type { Clock } from './clock';
import { repoRoot } from './config';
import type { Db } from './db';
import { AppError, isAppError } from './errors';
import { authRoutes } from './routes/auth';
import { metaRoutes } from './routes/meta';
import { workspaceRoutes } from './routes/workspace';
import { workspacesRoutes } from './routes/workspaces';

export interface AppOptions {
  db: Db;
  clock: Clock;
  /** Directory of the built web app to serve with an SPA fallback. */
  staticDir?: string | null;
  logger?: FastifyServerOptions['logger'];
  /** Mark session cookies `secure` on HTTPS requests (production). */
  secureCookies?: boolean;
  /** Reported by GET /api/meta; defaults to the root package.json version. */
  version?: string;
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/** Assemble the Fastify application. Used by `server.ts` and by the test-suite. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, trustProxy: true });
  app.decorate('ctx', { db: options.db, clock: options.clock });
  app.decorate('secureCookies', options.secureCookies ?? false);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);
  app.decorateRequest('ws', null);

  await app.register(cookie);
  app.addHook('onRequest', attachUser);

  app.setErrorHandler((error: unknown, request, reply) => {
    if (isAppError(error)) {
      void reply.status(error.status).send(error.toBody());
      return;
    }
    if (error instanceof ZodError) {
      void reply
        .status(400)
        .send(
          new AppError('validation_error', 'Please check the form', formatIssues(error)).toBody(),
        );
      return;
    }
    if (error instanceof UnbalancedEntryError) {
      void reply.status(422).send(
        new AppError('unbalanced_entry', error.message, {
          debitCents: error.debitCents,
          creditCents: error.creditCents,
        }).toBody(),
      );
      return;
    }
    const http = error as { statusCode?: unknown; message?: unknown };
    const status = typeof http.statusCode === 'number' ? http.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error, url: request.url }, 'Unhandled error');
      void reply.status(500).send(new AppError('internal_error', 'Something went wrong').toBody());
      return;
    }
    const message = typeof http.message === 'string' ? http.message : 'Request failed';
    const code =
      status === 401
        ? 'unauthenticated'
        : status === 403
          ? 'forbidden'
          : status === 404
            ? 'not_found'
            : status === 409
              ? 'conflict'
              : 'validation_error';
    void reply.status(status).send(new AppError(code, message).toBody());
  });

  const staticDir =
    options.staticDir && existsSync(join(options.staticDir, 'index.html'))
      ? options.staticDir
      : null;

  app.setNotFoundHandler((request, reply) => {
    if (staticDir && request.method === 'GET' && !request.url.startsWith('/api')) {
      return reply.type('text/html').send(readFileSync(join(staticDir, 'index.html')));
    }
    return reply
      .status(404)
      .send(new AppError('not_found', `Route ${request.method} ${request.url} not found`).toBody());
  });

  const version = options.version ?? readVersion();
  await app.register(
    async (api) => {
      await api.register(metaRoutes, { version });
      await api.register(authRoutes);
      await api.register(workspacesRoutes);
      await api.register(workspaceRoutes, { prefix: '/w/:slug' });
    },
    { prefix: '/api' },
  );

  if (staticDir) {
    await app.register(fastifyStatic, {
      root: staticDir,
      prefix: '/',
      index: ['index.html'],
    });
  }

  return app;
}
