/**
 * @file Tests for the edge cache interceptor, covering hits, misses, release keys and exclusions.
 */
import { describe, expect, jest, test } from '@jest/globals';
import { lastValueFrom, of } from 'rxjs';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { EdgeCacheInterceptor } from '../../../src/services/edge/edge-cache.interceptor.js';
import type { CallHandler } from '@nestjs/common';

class MemoryCache {
  store = new Map<string, Response>();
  async match(key: Request) {
    return this.store.get(key.url)?.clone();
  }
  async put(key: Request, value: Response) {
    this.store.set(key.url, value);
  }
}

/**
 * Builds a fake execution context with a request for the path and a response that records headers.
 * @param path - The request path.
 * @param headers - Request headers, keyed by lower-case name.
 * @param method - The HTTP method, defaulting to GET.
 * @returns The context together with the fake response, request and sent headers.
 * @example
 * ```ts
 * const { context, sent } = aContext('/', {}, 'GET');
 * ```
 */
function aContext(
  path: string,
  headers: Record<string, string> = {},
  method = 'GET',
) {
  const sent: Record<string, string> = {};
  const req = {
    method,
    path,
    url: path,
    get: (name: string) => headers[name.toLowerCase()],
  };
  const res = {
    statusCode: 200,
    sent,
    getHeader: (n: string) => sent[n],
    setHeader: (n: string, v: string) => {
      sent[n] = v;
    },
  };
  const context = new ExecutionContextHost([req, res]);
  return { context, res, sent, req };
}

/**
 * Builds an interceptor wired to the given in-memory cache and a fixed release.
 * @param cache - The cache to use, or undefined to simulate no Cache API.
 * @param paths - The paths the interceptor may cache.
 * @returns The configured edge cache interceptor.
 * @example
 * ```ts
 * const interceptor = build(new MemoryCache(), ['/']);
 * ```
 */
function build(cache: MemoryCache | undefined, paths = ['/']) {
  return new EdgeCacheInterceptor(paths, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the Workers Cache type is a large runtime-only surface and MemoryCache implements only match and put, which are all the interceptor calls, so the option type is not widened for a test
    cache: () => cache as unknown as Cache | undefined,
    env: async () => ({ CF_VERSION_METADATA: { id: 'v1' } }),
  });
}

describe('EdgeCacheInterceptor', () => {
  test('stores a page on a miss and replays it on a hit', async () => {
    const cache = new MemoryCache();
    const handler = jest.fn(() => of('<html>'));
    const first = aContext('/');
    first.sent['Content-Type'] = 'text/html; charset=utf-8';

    const a = await lastValueFrom(
      build(cache).intercept(first.context, { handle: handler } as CallHandler),
    );
    const second = aContext('/');
    const b = await lastValueFrom(
      build(cache).intercept(second.context, {
        handle: handler,
      } as CallHandler),
    );

    expect([a, b]).toEqual(['<html>', '<html>']);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(second.sent['X-Edge-Cache']).toBe('HIT');
    expect(second.sent['Content-Type']).toBe('text/html; charset=utf-8');
  });

  test('keys copies by release', async () => {
    const cache = new MemoryCache();
    const ctx = aContext('/');
    ctx.sent['Content-Type'] = 'text/html';
    await lastValueFrom(
      build(cache).intercept(ctx.context, { handle: () => of('x') }),
    );

    expect([...cache.store.keys()]).toEqual(['https://edge.invalid/v1/']);
  });

  test('replays binary bodies', async () => {
    const cache = new MemoryCache();
    const first = aContext('/og.png');
    first.sent['Content-Type'] = 'image/png';
    const interceptor = build(cache, ['/og.png']);
    await lastValueFrom(
      interceptor.intercept(first.context, {
        handle: () => of(Buffer.from([1, 2, 3])),
      }),
    );
    const hit = await lastValueFrom(
      interceptor.intercept(aContext('/og.png').context, {
        handle: () => of(Buffer.alloc(0)),
      }),
    );

    expect(hit).toEqual(Buffer.from([1, 2, 3]));
  });

  test.each([
    ['a cookie', '/', { cookie: 'a=b' }, 'GET'],
    ['an authorization header', '/', { authorization: 'x' }, 'GET'],
    ['a path not opted in', '/other', {}, 'GET'],
    ['a POST', '/', {}, 'POST'],
  ])('does not cache %s', async (_n, path, headers, method) => {
    const cache = new MemoryCache();
    const ctx = aContext(path, headers, method);
    ctx.sent['Content-Type'] = 'text/html';
    await lastValueFrom(
      build(cache).intercept(ctx.context, { handle: () => of('x') }),
    );

    expect(cache.store.size).toBe(0);
  });

  test('does not cache a query string', async () => {
    const cache = new MemoryCache();
    const ctx = aContext('/');
    ctx.req.url = '/?a=1';
    ctx.sent['Content-Type'] = 'text/html';
    await lastValueFrom(
      build(cache).intercept(ctx.context, { handle: () => of('x') }),
    );

    expect(cache.store.size).toBe(0);
  });

  test('does not cache responses that set a cookie or fail', async () => {
    const cache = new MemoryCache();
    const cookie = aContext('/');
    cookie.sent['Content-Type'] = 'text/html';
    cookie.sent['Set-Cookie'] = 'a=b';
    const failed = aContext('/');
    failed.sent['Content-Type'] = 'text/html';
    failed.res.statusCode = 500;
    const index = build(cache);
    await lastValueFrom(
      index.intercept(cookie.context, { handle: () => of('x') }),
    );
    await lastValueFrom(
      index.intercept(failed.context, { handle: () => of('x') }),
    );

    expect(cache.store.size).toBe(0);
  });

  test('does nothing without a Cache API', async () => {
    const ctx = aContext('/');
    const handler = jest.fn(() => of('x'));

    const body = await lastValueFrom(
      build().intercept(ctx.context, { handle: handler }),
    );

    expect(body).toBe('x');
    expect(handler.mock.calls).toHaveLength(1);
  });
});
