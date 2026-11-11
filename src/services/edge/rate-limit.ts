/**
 * @file Per-address rate limiter used as Express-style middleware on every request.
 */
import type { NextFunction, Request, Response } from 'express';
import { workerEnv, type WorkerEnv } from './env.js';

/** One Workers Rate Limiting binding: `limit` says whether `key` may go ahead. */
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitOptions {
  /**
   * Name of the Workers Rate Limiting binding that counts requests per client
   * address. Declare it in `wrangler.toml` (`[[ratelimits]]`); a generous
   * `limit = 300`, `period = 60` suits a small app. Default `RL_SITE`.
   */
  binding?: string;

  /**
   * Paths (and everything below them) that are never counted. GitHub delivers
   * webhooks in bursts from a few addresses, so `/hook` is exempt by default;
   * those routes authenticate by signature instead.
   */
  exempt?: readonly string[];
  /** Where the bindings come from; defaults to the Worker's `env`. */
  env?: () => Promise<WorkerEnv | undefined>;
}

const DEFAULT_EXEMPT: readonly string[] = ['/hook'];
const RETRY_AFTER_SECONDS = 60;

/**
 * Tells whether a value is a Workers Rate Limiting binding, which has a `limit` function.
 * @param value - The value taken from the Worker's bindings.
 * @returns True when the value exposes a `limit` function.
 * @example
 * ```ts
 * isBinding(env.RL_SITE); // true when the binding is configured
 * ```
 */
function isBinding(value: unknown): value is RateLimitBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { limit?: unknown }).limit === 'function'
  );
}

/**
 * Tells whether a request path falls under one of the exempt prefixes.
 * @param path - The request path, such as `/hook/github`.
 * @param exempt - The exempt path prefixes.
 * @returns True when the path equals a prefix or sits below it.
 * @example
 * ```ts
 * isExempt('/hook/github', ['/hook']); // true
 * ```
 */
function isExempt(path: string, exempt: readonly string[]): boolean {
  return exempt.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Express-style middleware that refuses callers over the per-address limit
 * with a 429. It fails open: with no binding (local development, tests) or a
 * binding that throws, the request goes through.
 * @param options - Binding name, exempt paths and the source of bindings.
 * @returns The Express-style middleware function.
 * @example
 * ```ts
 * app.use(createRateLimiter({ binding: 'RL_SITE', exempt: ['/hook'] }));
 * ```
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const name = options.binding ?? 'RL_SITE';
  const exempt = options.exempt ?? DEFAULT_EXEMPT;
  const getEnv = options.env ?? workerEnv;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS' || isExempt(req.path, exempt)) {
      return next();
    }
    const env = await getEnv();
    const binding = env?.[name];
    if (!isBinding(binding)) {
      return next();
    }
    const address = req.get('cf-connecting-ip') ?? req.ip ?? 'unknown';
    let allowed = true;
    try {
      const result = await binding.limit({ key: `a:${address}` });
      allowed = result.success;
    } catch {
      allowed = true;
    }
    if (allowed) {
      return next();
    }
    return res
      .status(429)
      .set({
        'Retry-After': String(RETRY_AFTER_SECONDS),
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      })
      .send('Too many requests. Wait a moment and try again.\n');
  };
}
