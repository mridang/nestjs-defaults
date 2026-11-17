/**
 * @file Tests for the request-context middleware, covering ECS fields and Cloudflare edge metadata.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { expect, jest, describe, test } from '@jest/globals';
import { ClsService } from 'nestjs-cls';

import { RequestIdMiddleware } from '../src/correlation.middleware.js';

/**
 * Creates a fake CLS service that runs callbacks immediately and records writes.
 * @returns The fake service and the mock that records its `set` calls.
 * @example
 * ```ts
 * const { cls, set } = makeCls();
 * new RequestIdMiddleware(cls).use(req, res, next);
 * ```
 */
function makeCls() {
  const cls = new ClsService(new AsyncLocalStorage());
  const set = jest.spyOn(cls, 'set');
  return { cls, set };
}

/**
 * Builds a representative incoming request with a browser user agent and Cloudflare-style headers.
 * @returns A request-shaped object for the middleware to read.
 * @example
 * ```ts
 * const req = baseRequest();
 * ```
 */
function baseRequest(): Parameters<RequestIdMiddleware['use']>[0] {
  return {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'content-length': '1024',
      'content-type': 'application/json',
      referer: 'https://example.com',
      'cf-ray': 'ray-abc123',
    },
    hostname: 'example.com',
    path: '/hook',
    protocol: 'https',
    originalUrl: '/hook?event=push',
    method: 'POST',
    ip: '203.0.113.5',
    httpVersion: '1.1',
    _parsedUrl: { query: 'event=push' },
  };
}

describe('RequestIdMiddleware', () => {
  test('records the runtime-agnostic ECS request context', () => {
    const { cls, set } = makeCls();
    const next = jest.fn();

    new RequestIdMiddleware(cls).use(baseRequest(), {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const context: unknown = set.mock.calls[0][1];
    expect(context).toMatchObject({
      url: {
        domain: 'example.com',
        path: '/hook',
        full: 'https://example.com/hook?event=push',
        original: '/hook?event=push',
        scheme: 'https',
        query: 'event=push',
      },
      user_agent: { name: 'Chrome', os: { name: 'Mac OS' } },
      http: {
        version: '1.1',
        request: {
          method: 'POST',
          bytes: 1024,
          mime_type: 'application/json',
          referrer: 'https://example.com',
          id: 'ray-abc123',
        },
      },
      client: { ip: '203.0.113.5' },
      faas: { coldstart: expect.any(Boolean), trigger: { type: 'http' } },
    });
  });

  test('maps Cloudflare edge metadata onto ECS geo, as, tls and cloud', () => {
    const { cls, set } = makeCls();
    const req = baseRequest();
    req.cf = {
      colo: 'DFW',
      country: 'US',
      city: 'Austin',
      region: 'Texas',
      regionCode: 'TX',
      continent: 'NA',
      latitude: '30.27130',
      longitude: '-97.74260',
      postalCode: '78701',
      timezone: 'America/Chicago',
      asn: 395_747,
      asOrganization: 'Cloudflare, Inc.',
      tlsVersion: 'TLSv1.3',
      tlsCipher: 'AEAD-AES128-GCM-SHA256',
    };

    new RequestIdMiddleware(cls).use(req, {}, jest.fn());

    const context: unknown = set.mock.calls[0][1];
    expect(context).toMatchObject({
      cloud: { region: 'DFW' },
      client: {
        ip: '203.0.113.5',
        geo: {
          country_iso_code: 'US',
          city_name: 'Austin',
          region_name: 'Texas',
          region_iso_code: 'TX',
          continent_code: 'NA',
          postal_code: '78701',
          timezone: 'America/Chicago',
          location: { lat: 30.2713, lon: -97.7426 },
        },
        as: { number: 395_747, organization: { name: 'Cloudflare, Inc.' } },
      },
      tls: {
        version: '1.3',
        version_protocol: 'tls',
        cipher: 'AEAD-AES128-GCM-SHA256',
      },
    });
  });
});
