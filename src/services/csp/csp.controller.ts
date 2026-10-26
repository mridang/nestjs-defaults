import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { summariseReports } from './csp-reports.js';

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
    const raw = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.isBuffer(req.body)
        ? req.body
        : undefined;
    if (raw === undefined) {
      return;
    }
    if (raw.length > MAX_REPORT_BYTES) {
      throw new PayloadTooLargeException();
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    summariseReports(payload).forEach((report) => {
      this.logger.warn(`csp-report ${JSON.stringify(report)}`);
    });
  }
}
