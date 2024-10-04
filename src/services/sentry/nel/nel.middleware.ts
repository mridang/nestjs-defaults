import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';

@Injectable()
export class NelMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Reporting-Endpoints', `nel-endpoint="/report"`);

    res.setHeader(
      'NEL',
      JSON.stringify({
        report_to: 'nel-endpoint',
        max_age: 10886400,
        include_subdomains: true,
        success_fraction: 0.0,
        failure_fraction: 1.0,
      }),
    );

    bodyParser.json({ type: 'application/reports+json' })(req, res, next);
  }
}
