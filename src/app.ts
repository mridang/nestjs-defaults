import { NestExpressApplication } from '@nestjs/platform-express';
import { CustomHttpExceptionFilter } from './services/errors/errors.filter.js';
import cookieParser from 'cookie-parser';
import { default as helm } from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { BetterLogger } from './logging/index.js';

/**
 * An Express-style middleware function `(req, res, next) => void`. Handlers that
 * omit `next` (e.g. the robots.txt responder) remain assignable to this.
 */
type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

/**
 * Minimal shape of an HTTP adapter that can wrap Express-style middleware so it
 * runs against an Express-shaped request/response. The Cloudflare Workers
 * adapter (`@mridang/nestjs-platform-cloudflare`) exposes this; the Express
 * adapter does not, since its native `app.use()` already speaks Express.
 */
interface ExpressMiddlewareAdapter {
  useExpressMiddleware(
    pathOrMiddleware: string | ExpressMiddleware,
    middleware?: ExpressMiddleware,
  ): void;
}

/**
 * Detect whether the application's HTTP adapter wraps Express middleware (the
 * Cloudflare Workers adapter) rather than running it natively (Express).
 */
function getExpressMiddlewareAdapter(
  nestApp: NestExpressApplication,
): ExpressMiddlewareAdapter | undefined {
  const adapter = nestApp.getHttpAdapter() as unknown as
    | Partial<ExpressMiddlewareAdapter>
    | undefined;
  return typeof adapter?.useExpressMiddleware === 'function'
    ? (adapter as ExpressMiddlewareAdapter)
    : undefined;
}

export default function configure(nestApp: NestExpressApplication) {
  nestApp.useLogger(nestApp.get(BetterLogger));
  nestApp.useGlobalFilters(new CustomHttpExceptionFilter());

  // Express middleware (the robots.txt handler, the cold-start header, cookie
  // parsing and Helmet) must run with an Express-shaped request/response. The
  // Express adapter provides that through `nestApp.use(...)` directly, but the
  // Cloudflare Workers adapter runs `use(...)` middleware against native
  // Fetch-style objects, so Express middleware has to be routed through its
  // `useExpressMiddleware(...)` compatibility layer instead.
  const expressAdapter = getExpressMiddlewareAdapter(nestApp);
  const mountAt = (path: string, mw: ExpressMiddleware) =>
    expressAdapter
      ? expressAdapter.useExpressMiddleware(path, mw)
      : (nestApp.use as (path: string, mw: ExpressMiddleware) => void)(
          path,
          mw,
        );
  const mount = (mw: ExpressMiddleware) =>
    expressAdapter
      ? expressAdapter.useExpressMiddleware(mw)
      : (nestApp.use as (mw: ExpressMiddleware) => void)(mw);

  mountAt('/robots.txt', (_req: Request, res: Response) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
  });
  mount(cookieParser());
  mount(
    helm({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            'js.pusher.com',
            "'unsafe-eval'",
          ],
          'connect-src': [
            "'self'",
            '*.pusher.com',
            'ws.pusherapp.com',
            'wss://ws-mt1.pusher.com',
            '*.sentry.io',
          ],
          'worker-src': ["'self'", 'blob:'],
          'style-src': ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
          'img-src': ["'self'", 'data:', 'avatars.githubusercontent.com'],
          'font-src': ["'self'", 'fonts.gstatic.com'],
          'form-action': ['*'],
        },
      },
    }),
  );
  nestApp.enableCors({
    credentials: true,
  });
  nestApp.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
        }));
        return new BadRequestException(messages);
      },
    }),
  );

  return nestApp;
}
