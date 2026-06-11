import { Inject, Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import UAParser from 'ua-parser-js';
import path from 'node:path';

/**
 * Injection token for an optional FaaS execution-context provider. Serverless
 * runtimes can bind a function returning the current invocation's context so
 * its identifiers populate the `faas.*` log fields — e.g. on AWS Lambda:
 *
 * ```ts
 * import { getCurrentInvoke } from '@codegenie/serverless-express';
 * { provide: FAAS_CONTEXT, useValue: () => getCurrentInvoke()?.context }
 * ```
 *
 * Runtimes without a FaaS context (e.g. Cloudflare Workers) leave it unbound
 * and those fields stay empty. The provider is the only place the core would
 * otherwise need a cloud-provider package, so keeping it injected means neither
 * AWS nor Workers pulls in deps it does not use.
 */
export const FAAS_CONTEXT = Symbol('FAAS_CONTEXT');

/**
 * Minimal shape of a FaaS execution context — the subset of the AWS Lambda
 * `Context` used for ECS `faas.*` logging fields, declared locally so the core
 * depends on no cloud-provider package.
 */
export interface FaasContext {
  functionName?: string;
  functionVersion?: string;
  invokedFunctionArn?: string;
  awsRequestId?: string;
  logStreamName?: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private isColdStart = true;
  private readonly uaCache = new Map<string, UAParser.IResult>();

  constructor(
    private readonly clsService: ClsService,
    @Optional()
    @Inject(FAAS_CONTEXT)
    private readonly currentInvoke: () => FaasContext | undefined = () =>
      undefined,
  ) {
    //
  }

  use(
    req: Request & { _parsedUrl?: { query: string } },
    _res: Response,
    next: NextFunction,
  ) {
    const context = this.currentInvoke();

    const userAgentString = req?.headers['user-agent'] || '';
    let uaResult: UAParser.IResult;
    if (this.uaCache.has(userAgentString)) {
      uaResult = this.uaCache.get(userAgentString) as UAParser.IResult;
    } else {
      const parser = new UAParser(userAgentString);
      uaResult = parser.getResult();
      this.uaCache.set(userAgentString, uaResult);
    }

    this.clsService.run(() => {
      this.clsService.set('ctx', {
        url: {
          domain: req.hostname,
          extension: path.extname(req.path) || undefined,
          fragment: undefined,
          full: `${req.protocol}://${req.hostname}${req.originalUrl}`,
          original: req?.originalUrl,
          path: req.path,
          port: req.socket?.localPort,
          query: req._parsedUrl?.query,
          scheme: req.protocol,
          username: undefined,
          password: undefined,
          registered_domain: undefined,
          subdomain: undefined,
          top_level_domain: undefined,
        },
        user_agent: {
          device: {
            name: uaResult.device?.model,
          },
          name: uaResult.browser?.name,
          original: userAgentString,
          os: {
            family: uaResult.os?.name,
            full: `${uaResult.os?.name} ${uaResult.os?.version}`.trim(),
            kernel: undefined, // Unable to deduce
            name: uaResult.os?.name,
            platform: uaResult.os?.name,
            type: undefined, // Unable to deduce
            version: uaResult.os?.version,
          },
          version: uaResult.browser?.version,
        },
        http: {
          response: undefined,
          request: {
            body: undefined,
            bytes: req.headers['content-length'],
            // Edge-assigned request id: `cf-ray` on Cloudflare, `x-amz-cf-id`
            // on AWS CloudFront. Either gives a correlation id to trace by.
            id: req.headers['cf-ray'] ?? req.headers['x-amz-cf-id'],
            method: req.method,
            mime_type: req.headers['content-type'],
            referrer: req.headers['referer'],
          },
          version: req.httpVersion,
        },
        faas: {
          coldstart: this.isColdStart,
          execution: context?.logStreamName,
          id: context?.invokedFunctionArn,
          name: context?.functionName,
          trigger: {
            request_id: context?.awsRequestId,
            type: 'http',
          },
          version: context?.functionVersion,
        },
      });

      this.isColdStart = false;
      next();
    });
  }
}
