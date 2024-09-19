import { Injectable, NestMiddleware, Optional } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getCurrentInvoke } from '@codegenie/serverless-express';
import { ClsService } from 'nestjs-cls';
import { Context } from 'aws-lambda';
import UAParser from 'ua-parser-js';
import path from 'node:path';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private isColdStart = true;
  private readonly uaCache = new Map<string, UAParser.IResult>();

  constructor(
    private readonly clsService: ClsService,
    @Optional()
    private readonly currentInvoke: () => Context = () => {
      return getCurrentInvoke().context as Context;
    },
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
          port: req.socket.localPort,
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
            id: req.headers['x-amz-cf-id'],
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
