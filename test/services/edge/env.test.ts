/**
 * @file Tests for the edge environment lookup used outside Cloudflare Workers.
 */
import { describe, expect, test } from '@jest/globals';
import { workerEnv } from '../../../src/services/edge/env';

describe('workerEnv', () => {
  test('is undefined outside Cloudflare Workers', async () => {
    expect(await workerEnv()).toBeUndefined();
  });
});
