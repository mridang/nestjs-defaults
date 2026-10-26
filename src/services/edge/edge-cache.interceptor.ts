import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { workerEnv, type WorkerEnv } from './env.js';

/** Used when the app gave the page no Cache-Control of its own. */
const DEFAULT_CACHE_CONTROL = 'public, max-age=300';

/** Responses worth keeping: the page, image or feed itself, never an error. */
const KEPT_BODY = (body: unknown): body is string | Uint8Array =>
  typeof body === 'string' || body instanceof Uint8Array;

/** Where kept copies live and how a release is told apart. */
export interface EdgeCacheSources {
  /** Cloudflare's per-location cache; absent under plain Node. */
  cache?: () => Cache | undefined;
  /** The Worker's bindings; the release id comes from them. */
  env?: () => Promise<WorkerEnv | undefined>;
}

function defaultCache(): Cache | undefined {
  const store = Reflect.get(globalThis, 'caches') as
    | { default?: Cache }
    | undefined;
  return store?.default;
}

/** The deployed release, so a new deploy never serves an old copy. */
function releaseOf(env: WorkerEnv | undefined): string {
  const metadata = env?.['CF_VERSION_METADATA'] as { id?: string } | undefined;
  const version = env?.['SERVICE_VERSION'];
  return metadata?.id ?? (typeof version === 'string' ? version : 'dev');
}

/**
 * Answers anonymous GETs of an opt-in list of paths from the Workers Cache
 * API. Anything with a cookie, an authorization header or a query string is
 * left to the app, as is anything that sets a cookie. Copies are keyed by
 * release. With no Cache API (local development, tests) it does nothing.
 */
@Injectable()
export class EdgeCacheInterceptor implements NestInterceptor {
  private readonly paths: ReadonlySet<string>;
  private readonly sources: Required<EdgeCacheSources>;

  constructor(paths: readonly string[], sources: EdgeCacheSources = {}) {
    this.paths = new Set(paths);
    this.sources = {
      cache: sources.cache ?? defaultCache,
      env: sources.env ?? workerEnv,
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<ExpressRequest>();
    const res = context.switchToHttp().getResponse<ExpressResponse>();
    const cache = this.sources.cache();
    const url = req.originalUrl ?? req.url;
    if (
      cache === undefined ||
      req.method !== 'GET' ||
      !this.paths.has(req.path) ||
      url.includes('?') ||
      req.get('cookie') ||
      req.get('authorization')
    ) {
      return next.handle();
    }

    return from(this.sources.env()).pipe(
      switchMap((env) => {
        const key = new Request(
          `https://edge.invalid/${encodeURIComponent(releaseOf(env))}${req.path}`,
        );
        return from(cache.match(key)).pipe(
          switchMap((hit) => {
            if (hit === undefined) {
              return next
                .handle()
                .pipe(
                  switchMap((body) => from(this.keep(cache, key, res, body))),
                );
            }
            return from(this.replay(hit, res));
          }),
        );
      }),
    );
  }

  private async replay(hit: Response, res: ExpressResponse) {
    const type = hit.headers.get('content-type');
    if (type) {
      res.setHeader('Content-Type', type);
    }
    res.setHeader(
      'Cache-Control',
      hit.headers.get('cache-control') ?? DEFAULT_CACHE_CONTROL,
    );
    res.setHeader('X-Edge-Cache', 'HIT');
    const bytes = new Uint8Array(await hit.arrayBuffer());
    return type?.startsWith('text/')
      ? new TextDecoder().decode(bytes)
      : Buffer.from(bytes);
  }

  private async keep(
    cache: Cache,
    key: Request,
    res: ExpressResponse,
    body: unknown,
  ): Promise<unknown> {
    const type = res.getHeader('Content-Type');
    const control = res.getHeader('Cache-Control');
    const cacheControl =
      typeof control === 'string' ? control : DEFAULT_CACHE_CONTROL;
    if (
      KEPT_BODY(body) &&
      res.statusCode === 200 &&
      typeof type === 'string' &&
      !res.getHeader('Set-Cookie')
    ) {
      await cache.put(
        key,
        new Response(typeof body === 'string' ? body : new Uint8Array(body), {
          headers: {
            'Content-Type': type,
            'Cache-Control': cacheControl,
          },
        }),
      );
    }
    return body;
  }
}
