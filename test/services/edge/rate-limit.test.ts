import { describe, expect, jest, test } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from '../../../src/services/edge/rate-limit';

function aRequest(path: string, method = 'GET'): Request {
  return {
    path,
    method,
    ip: '1.2.3.4',
    get: (name: string) =>
      name === 'cf-connecting-ip' ? '9.9.9.9' : undefined,
  } as unknown as Request;
}

function aResponse() {
  const res = {
    status: jest.fn(() => res),
    set: jest.fn(() => res),
    send: jest.fn(() => res),
  };
  return res;
}

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
