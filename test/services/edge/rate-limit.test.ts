/**
 * @file Tests for the per-address rate limiter, covering limits, exemptions and fail-open behaviour.
 */
import { readFile } from 'node:fs/promises';
import { describe, expect, jest, test } from '@jest/globals';

import { createRateLimiter } from '../../../src/services/edge/rate-limit.js';
// eslint-disable-next-line e18e/ban-dependencies -- express is the Nest HTTP adapter this library targets and the import is type-only; h3 does not provide these types, so the swap is not a drop-in
import type { NextFunction } from 'express';

/** The request the limiter reads. */
type LimiterRequest = Parameters<ReturnType<typeof createRateLimiter>>[0];

/** Signature of a Workers Rate Limiting binding's `limit` method. */
type RateLimit = (options: { key: string }) => Promise<{ success: boolean }>;

/**
 * Tells whether the parsed fixture holds the two addresses the tests use.
 * @param value - The parsed JSON of the fixture file.
 * @returns True when it has a string `clientIp` and a string `cloudflareIp`.
 * @example
 * ```ts
 * isIps({ clientIp: '203.0.113.5', cloudflareIp: '198.51.100.7' }); // true
 * ```
 */
function isIps(
  value: unknown,
): value is { clientIp: string; cloudflareIp: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'clientIp' in value &&
    typeof value.clientIp === 'string' &&
    'cloudflareIp' in value &&
    typeof value.cloudflareIp === 'string'
  );
}

const parsedIps: unknown = JSON.parse(
  await readFile(new URL('../../fixtures/ips.json', import.meta.url), 'utf8'),
);
if (!isIps(parsedIps)) {
  throw new TypeError('ips.json must hold a clientIp and a cloudflareIp');
}
const ips = {
  clientIp: parsedIps.clientIp,
  cloudflareIp: parsedIps.cloudflareIp,
};

/**
 * Builds a request-shaped object with a client address and an optional Cloudflare address header.
 * @param path - Where the request is aimed, such as `/hook`.
 * @param method - The HTTP method, defaulting to GET.
 * @returns A request-shaped object for the limiter to read.
 * @example
 * ```ts
 * const req = aRequest('/hook', 'POST');
 * ```
 */
function aRequest(path: string, method = 'GET'): LimiterRequest {
  return {
    path,
    method,
    ip: ips.clientIp,
    get: (name: string) =>
      name === 'cf-connecting-ip' ? ips.cloudflareIp : undefined,
  };
}

/** The chained response methods the limiter may call, each returning the response. */
interface FakeResponse {
  status: jest.Mock<(code: number) => FakeResponse>;
  set: jest.Mock<(name: string, value: string) => FakeResponse>;
  send: jest.Mock<(body?: unknown) => FakeResponse>;
}

/**
 * Builds a fake Express response whose chained methods all return the response.
 * @returns The fake response with `status`, `set` and `send` mocks.
 * @example
 * ```ts
 * const res = aResponse();
 * res.status(429);
 * ```
 */
function aResponse(): FakeResponse {
  const res: FakeResponse = {
    status: jest.fn<(code: number) => FakeResponse>(() => res),
    set: jest.fn<(name: string, value: string) => FakeResponse>(() => res),
    send: jest.fn<(body?: unknown) => FakeResponse>(() => res),
  };
  return res;
}

/**
 * Runs the limiter against a request and reports what happened to the response and `next`.
 * @param limiter - The middleware returned by createRateLimiter.
 * @param req - The request to run it against.
 * @returns The response mock and the `next` mock.
 * @example
 * ```ts
 * const { next } = await run(createRateLimiter(), aRequest('/'));
 * ```
 */
async function run(
  limiter: ReturnType<typeof createRateLimiter>,
  req: LimiterRequest,
) {
  const res = aResponse();
  const next = jest.fn();
  await limiter(req, res, next as NextFunction);
  return { res, next };
}

describe('createRateLimiter', () => {
  test('lets everything through when there is no binding', async () => {
    const { next } = await run(
      createRateLimiter({ env: async () => undefined }),
      aRequest('/'),
    );

    expect(next.mock.calls).toHaveLength(1);
  });

  test('counts by client address and refuses over the limit', async () => {
    const limit = jest.fn<RateLimit>(async () => ({ success: false }));
    const { res, next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(limit.mock.calls).toEqual([[{ key: `a:${ips.cloudflareIp}` }]]);
    expect(next.mock.calls).toHaveLength(0);
    expect(res.status.mock.calls).toEqual([[429]]);
  });

  test('lets requests under the limit through', async () => {
    const limit = jest.fn<RateLimit>(async () => ({ success: true }));
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(next.mock.calls).toHaveLength(1);
  });

  test('fails open when the binding throws', async () => {
    const limit = jest.fn<RateLimit>(async () => {
      throw new Error('down');
    });
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(next.mock.calls).toHaveLength(1);
  });

  test.each(['/hook', '/hook/x'])('never counts %s', async (path) => {
    const limit = jest.fn<RateLimit>(async () => ({ success: false }));
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest(path, 'POST'),
    );

    expect(limit.mock.calls).toHaveLength(0);
    expect(next.mock.calls).toHaveLength(1);
  });

  test('uses the configured binding name', async () => {
    const limit = jest.fn<RateLimit>(async () => ({ success: true }));
    await run(
      createRateLimiter({
        binding: 'OTHER',
        env: async () => ({ OTHER: { limit } }),
      }),
      aRequest('/'),
    );

    expect(limit.mock.calls).toHaveLength(1);
  });
});
