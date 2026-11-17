/**
 * @file Controller that receives Content-Security-Policy and Reporting API reports from browsers.
 */
import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
  Post,
  Req,
} from '@nestjs/common';

import { summariseReports } from './csp-reports.js';
// eslint-disable-next-line e18e/ban-dependencies -- express is the Nest HTTP adapter this library targets and the import is type-only or supplies the middleware types; h3 does not provide these types, so the swap is not a drop-in
import type { Request } from 'express';

/** The largest report body read: a few reports are a few hundred bytes each. */
export const MAX_REPORT_BYTES = 16_384;

/**
 * Receives Content Security Policy violation reports from browsers
 * (`application/csp-report` and `application/reports+json`) and writes one
 * summary line per report to the application log.
 */
@Controller('csp/reports')
export class CspReportsController {
  private readonly logger = new Logger(CspReportsController.name);

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  receive(@Req() req: Request & { rawBody?: Buffer }): void {
    const raw = [req.rawBody, req.body].find((candidate): candidate is Buffer =>
      Buffer.isBuffer(candidate),
    );
    if (raw === undefined) {
      return;
    }
    if (raw.length > MAX_REPORT_BYTES) {
      throw new PayloadTooLargeException();
    }
    // eslint-disable-next-line tslop/no-unknown-returns -- the report body is arbitrary JSON that summariseReports validates
    const payload = ((): unknown => {
      try {
        return JSON.parse(raw.toString('utf8'));
      } catch {
        return undefined;
      }
    })();
    if (payload === undefined) {
      return;
    }
    // eslint-disable-next-line functional/no-loop-statements -- only logs each report
    for (const report of summariseReports(payload)) {
      this.logger.warn(`csp-report ${JSON.stringify(report)}`);
    }
  }
}
