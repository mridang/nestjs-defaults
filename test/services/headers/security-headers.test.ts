import { describe, expect, jest, test } from '@jest/globals';
import type { Request, Response } from 'express';
import {
  PERMISSIONS_POLICY,
  securityHeaders,
} from '../../../src/services/headers/security-headers';

describe('securityHeaders', () => {
  test('sets the permissions policy and reporting endpoint', () => {
    const setHeader = jest.fn();
    const next = jest.fn();

    securityHeaders({} as Request, { setHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith(
      'Permissions-Policy',
      PERMISSIONS_POLICY,
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Reporting-Endpoints',
      'csp-endpoint="/csp/reports"',
    );
    expect(next).toHaveBeenCalled();
  });
});
