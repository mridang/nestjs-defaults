import { expect, describe, test, jest } from '@jest/globals';
import {
  NelController,
  ReportDto,
} from '../../../../src/services/sentry/nel/nel.controller';
import { NelException } from '../../../../src/services/sentry/nel/nel.exception';
import { NoopSentryReporter } from '../../../../src/services/sentry/reporter';

/**
 * Build a representative NEL report payload.
 */
function aReport(): ReportDto {
  return {
    age: 29662,
    body: {
      elapsedTime: 305,
      method: 'GET',
      phase: 'application',
      protocol: 'h3',
      referrer: '',
      samplingFraction: 1,
      serverIp: '2606:4700:3033::6815:487c',
      statusCode: 404,
      type: 'http.error',
    },
    type: 'network-error',
    url: 'https://local.mrida.ng/static/js/app.js',
    userAgent: 'Mozilla/5.0',
  };
}

describe('NelController', () => {
  test('reports every received report to Sentry as a NelException', () => {
    const reporter = new NoopSentryReporter();
    const capture = jest.spyOn(reporter, 'captureException');
    const controller = new NelController(reporter);

    controller.handleReport([aReport(), aReport()]);

    expect(capture).toHaveBeenCalledTimes(2);
    expect(capture.mock.calls[0][0]).toBeInstanceOf(NelException);
  });
});
