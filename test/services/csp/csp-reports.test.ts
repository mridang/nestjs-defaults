import { describe, expect, test } from '@jest/globals';
import { summariseReports } from '../../../src/services/csp/csp-reports';

describe('summariseReports', () => {
  test('reads the legacy csp-report format with paths only', () => {
    const [report] = summariseReports({
      'csp-report': {
        'document-uri': 'https://a.test/page?code=secret',
        'blocked-uri': 'https://evil.test/x.js',
        'violated-directive': 'script-src-elem',
      },
    });

    expect(report).toMatchObject({
      type: 'csp-violation',
      page: '/page',
      blocked: 'https://evil.test',
      directive: 'script-src-elem',
    });
  });

  test('reads the Reporting API format', () => {
    const reports = summariseReports([
      {
        type: 'csp-violation',
        body: { documentURL: 'https://a.test/', blockedURL: 'inline' },
      },
    ]);

    expect(reports).toHaveLength(1);
    expect(reports[0].blocked).toBe('inline');
  });

  test('ignores extensions and non-reports', () => {
    expect(
      summariseReports({
        'csp-report': { 'blocked-uri': 'chrome-extension://abc/x.js' },
      }),
    ).toEqual([]);
    expect(summariseReports('nope')).toEqual([]);
  });
});
