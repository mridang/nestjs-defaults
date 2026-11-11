/**
 * @file Middleware that records request-scoped Elastic Common Schema context into CLS.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import type { Ecs } from '@elastic/ecs';
import UAParser from 'ua-parser-js';
import path from 'node:path';

/**
 * The subset of Cloudflare's `request.cf` metadata mapped onto ECS. Present
 * only when the platform adapter attaches it to the request.
 */
interface CloudflareProperties {
  /** Three-letter IATA code of the serving data centre, e.g. `'DFW'`. */
  colo?: string;
  /** Two-letter client country code. */
  country?: string;
  /** Client city name. */
  city?: string;
  /** ISO 3166-2 region name. */
  region?: string;
  /** ISO 3166-2 region code. */
  regionCode?: string;
  /** Continent code, e.g. `'NA'`. */
  continent?: string;
  /** Client latitude as a string. */
  latitude?: string;
  /** Client longitude as a string. */
  longitude?: string;
  /** Client postal code. */
  postalCode?: string;
  /** Client IANA timezone. */
  timezone?: string;
  /** Client autonomous system number. */
  asn?: number;
  /** Organisation owning the client ASN. */
  asOrganization?: string;
  /** Negotiated TLS version, e.g. `'TLSv1.3'`. */
  tlsVersion?: string;
  /** Negotiated TLS cipher suite. */
  tlsCipher?: string;
}

/**
 * An Express request that may carry Cloudflare edge metadata.
 */
type EdgeRequest = Request & {
  /** Cloudflare per-request metadata, when the adapter provides it. */
  cf?: CloudflareProperties;
  /** Express-parsed URL components, when available. */
  _parsedUrl?: { query: string };
};

/**
 * Tracks whether the current isolate has handled a request yet.
 */
let warm = false;

/**
 * Report whether this is the first request handled by the current isolate, and
 * mark the isolate warm.
 *
 * This is the single piece of mutable state the request context needs:
 * cold-start status is, by definition, a fact about previous invocations.
 * @returns `true` only for the first request after the isolate starts.
 * @example
 * ```ts
 * consumeColdStart(); // true on the first call in an isolate
 * consumeColdStart(); // false afterwards
 * ```
 */
function consumeColdStart(): boolean {
  if (warm) {
    return false;
  }
  warm = true;
  return true;
}

/**
 * Parses a Cloudflare TLS version string such as `'TLSv1.3'` into `'1.3'`.
 * @param tlsVersion - The Cloudflare TLS version string.
 * @returns The bare version number, or `undefined` when not parseable.
 * @example
 * ```ts
 * parseTlsVersion('TLSv1.3'); // '1.3'
 * ```
 */
function parseTlsVersion(tlsVersion?: string): string | undefined {
  return tlsVersion?.replace(/^TLSv/, '');
}

/**
 * Maps Cloudflare edge metadata onto the ECS fields it corresponds to.
 * @param cf - The Cloudflare request metadata.
 * @returns The ECS fields derived from the edge metadata.
 * @example
 * ```ts
 * mapEdgeMetadata({ colo: 'DFW', country: 'US', tlsVersion: 'TLSv1.3' });
 * ```
 */
function mapEdgeMetadata(cf: CloudflareProperties): Partial<Ecs> {
  return {
    cloud: { region: cf.colo },
    client: {
      geo: {
        country_iso_code: cf.country,
        city_name: cf.city,
        region_name: cf.region,
        region_iso_code: cf.regionCode,
        continent_code: cf.continent,
        postal_code: cf.postalCode,
        timezone: cf.timezone,
        location:
          cf.latitude && cf.longitude
            ? { lat: Number(cf.latitude), lon: Number(cf.longitude) }
            : undefined,
      },
      as: {
        number: cf.asn,
        organization: { name: cf.asOrganization },
      },
    },
    tls: {
      version: parseTlsVersion(cf.tlsVersion),
      version_protocol: 'tls',
      cipher: cf.tlsCipher,
    },
  };
}

/**
 * Middleware that records request-scoped Elastic Common Schema fields into CLS.
 *
 * Every field {@link BetterLogger} attaches to a request — `url`, `user_agent`,
 * `http`, `client`, `faas`, and, on Cloudflare, the edge `geo`/`tls`/`cloud`
 * metadata — is assembled here and stored under the `ctx` key, where the logger
 * merges it into each document. The mapping is runtime-agnostic; provider
 * extras are added only when the request actually carries them.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly uaCache = new Map<string, UAParser.IResult>();

  /**
   * Creates the middleware with the request-scoped store it writes to.
   * @param clsService - The request-scoped store the context is written to.
   * @example
   * ```ts
   * consumer.apply(new RequestIdMiddleware(clsService)).forRoutes('*');
   * ```
   */
  constructor(private readonly clsService: ClsService) {}

  /**
   * Assembles the ECS request context and stores it for the duration of the call.
   * @param req - The incoming request.
   * @param _res - The outgoing response (unused).
   * @param next - The next handler in the chain.
   * @example
   * ```ts
   * middleware.use(req, res, () => logger.log('handled'));
   * ```
   */
  use(req: EdgeRequest, _res: Response, next: NextFunction): void {
    const userAgent = req.headers['user-agent'] ?? '';
    const parsed = this.parseUserAgent(userAgent);
    const edge = req.cf ? mapEdgeMetadata(req.cf) : {};

    const context: Partial<Ecs> = {
      url: {
        domain: req.hostname,
        path: req.path,
        full: `${req.protocol}://${req.hostname}${req.originalUrl}`,
        original: req.originalUrl,
        scheme: req.protocol,
        extension: path.extname(req.path) || undefined,
        query: req._parsedUrl?.query,
      },
      user_agent: {
        original: userAgent,
        name: parsed.browser?.name,
        version: parsed.browser?.version,
        device: { name: parsed.device?.model },
        os: { name: parsed.os?.name, version: parsed.os?.version },
      },
      http: {
        version: req.httpVersion,
        request: {
          method: req.method,
          bytes: this.toNumber(req.headers['content-length']),
          mime_type: req.headers['content-type'],
          referrer: req.headers['referer'],
          id: this.firstHeader(req.headers['cf-ray']),
        },
      },
      faas: {
        coldstart: consumeColdStart(),
        trigger: { type: 'http' },
      },
      ...edge,
      client: { ip: req.ip, ...edge.client },
    };

    this.clsService.run(() => {
      this.clsService.set('ctx', context);
      next();
    });
  }

  /**
   * Parses a user-agent string, caching results to avoid reparsing repeats.
   * @param userAgent - The raw user-agent header text.
   * @returns The parsed user-agent result.
   * @example
   * ```ts
   * this.parseUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0').browser.name;
   * ```
   */
  private parseUserAgent(userAgent: string): UAParser.IResult {
    const cached = this.uaCache.get(userAgent);
    if (cached) {
      return cached;
    }
    const result = new UAParser(userAgent).getResult();
    this.uaCache.set(userAgent, result);
    return result;
  }

  /**
   * Coerces a possibly-array header value to its first string.
   * @param value - A header value that may be repeated as an array.
   * @returns The first string value, or `undefined`.
   * @example
   * ```ts
   * this.firstHeader(['a', 'b']); // 'a'
   * ```
   */
  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Parses a numeric header value.
   * @param value - A header value that may be repeated as an array.
   * @returns The parsed number, or `undefined` when absent or invalid.
   * @example
   * ```ts
   * this.toNumber('42'); // 42
   * ```
   */
  private toNumber(value: string | string[] | undefined): number | undefined {
    const single = this.firstHeader(value);
    if (single === undefined) {
      return undefined;
    }
    const parsed = Number(single);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
