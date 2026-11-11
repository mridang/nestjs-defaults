/**
 * @file Middleware that sets the security headers and the Content-Security-Policy on every response.
 */
import type { NextFunction, Request, Response } from 'express';

/** Where browsers send Content Security Policy violation reports. */
export const CSP_REPORT_PATH = '/csp/reports';

/** The browser features no page of ours uses, switched off. */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';

/**
 * Sets the headers Helmet does not emit: `Permissions-Policy`, and the
 * `Reporting-Endpoints` header that names the `csp-endpoint` group the policy's
 * `report-to` directive refers to.
 * @param _req - The incoming request, which is not needed here.
 * @param res - The outgoing response that receives the headers.
 * @param next - Passes control to the next middleware.
 * @example
 * ```ts
 * app.use(securityHeaders);
 * ```
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Reporting-Endpoints', `csp-endpoint="${CSP_REPORT_PATH}"`);
  next();
}
