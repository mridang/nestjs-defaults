/**
 * @file Tests for the per-address rate limiter, covering limits, exemptions and fail-open behaviour.
 */
import { describe, expect, jest, test } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from '../../../src/services/edge/rate-limit';

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
function aRequest(path: string, method = 'GET'): Request {
  return {
    path,
    method,
    // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture
    ip: '1.2.3.4',
    get: (name: string) =>
      // eslint-disable-next-line sonarjs/no-hardcoded-ip -- test fixture
      name === 'cf-connecting-ip' ? '9.9.9.9' : undefined,
  } as unknown as Request;
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
function aResponse() {
  const res = {
    status: jest.fn(() => res),
    set: jest.fn(() => res),
    send: jest.fn(() => res),
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
  req: Request,
) {
  const res = aResponse();
  const next = jest.fn();
  await limiter(req, res as unknown as Response, next as NextFunction);
  return { res, next };
}

describe('createRateLimiter', () => {
  test('lets everything through when there is no binding', async () => {
    const { next } = await run(
      createRateLimiter({ env: async () => undefined }),
      aRequest('/'),
    );

    expect(next).toHaveBeenCalled();
  });

  test('counts by client address and refuses over the limit', async () => {
    const limit = jest.fn(async () => ({ success: false }));
    const { res, next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(limit).toHaveBeenCalledWith({ key: 'a:9.9.9.9' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('lets requests under the limit through', async () => {
    const limit = jest.fn(async () => ({ success: true }));
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(next).toHaveBeenCalled();
  });

  test('fails open when the binding throws', async () => {
    const limit = jest.fn(async () => {
      throw new Error('down');
    });
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest('/'),
    );

    expect(next).toHaveBeenCalled();
  });

  test.each(['/hook', '/hook/x'])('never counts %s', async (path) => {
    const limit = jest.fn(async () => ({ success: false }));
    const { next } = await run(
      createRateLimiter({ env: async () => ({ RL_SITE: { limit } }) }),
      aRequest(path, 'POST'),
    );

    expect(limit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('uses the configured binding name', async () => {
    const limit = jest.fn(async () => ({ success: true }));
    await run(
      createRateLimiter({
        binding: 'OTHER',
        env: async () => ({ OTHER: { limit } }),
      }),
      aRequest('/'),
    );

    expect(limit).toHaveBeenCalled();
  });
});
