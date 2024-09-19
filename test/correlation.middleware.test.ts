import { expect } from '@jest/globals';
import { ClsService } from 'nestjs-cls';
import { Context } from 'aws-lambda';
import { createRequest, createResponse } from 'node-mocks-http';
import { RequestIdMiddleware } from '../src/correlation.middleware';

const mockClsService: Partial<ClsService> = {
  run: jest.fn().mockImplementation((fn: () => void) => fn()),
  set: jest.fn(),
};

describe('correlation.middleware test', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware(mockClsService as ClsService, () => {
      return {
        awsRequestId: 'test-request-id',
        logStreamName: 'test-log-stream',
        invokedFunctionArn: 'test-function-arn',
        functionName: 'test-function',
        functionVersion: '1.0',
      } as Context;
    });
  });

  test('should parse the request and set the context correctly', () => {
    const nextFn: jest.Mock = jest.fn();

    middleware.use(
      createRequest({
        method: 'GET',
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'content-length': '1024',
          'x-amz-cf-id': 'test-cf-id',
          'content-type': 'application/json',
          referer: 'https://example.com',
        },
        protocol: 'https',
        url: '/test/path?query=1',
        path: '/test/path',
        hostname: 'example.com',
        httpVersion: '1.1',
      }),
      createResponse(),
      nextFn,
    );

    expect(nextFn).toHaveBeenCalled();
    expect(mockClsService.run).toHaveBeenCalled();
    expect(mockClsService.set).toHaveBeenCalledWith('ctx', {
      url: {
        domain: 'example.com',
        extension: undefined,
        fragment: undefined,
        full: 'https://example.com/test/path?query=1',
        original: '/test/path?query=1',
        path: '/test/path',
        port: undefined, // node-mocks-http doesn't provide localPort in socket mock
        query: undefined,
        scheme: 'https',
        username: undefined,
        password: undefined,
        registered_domain: undefined,
        subdomain: undefined,
        top_level_domain: undefined,
      },
      user_agent: {
        device: {
          name: 'Macintosh',
        },
        name: 'Chrome',
        original:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        os: {
          family: 'Mac OS',
          full: 'Mac OS 10.15.7',
          kernel: undefined,
          name: 'Mac OS',
          platform: 'Mac OS',
          type: undefined,
          version: '10.15.7',
        },
        version: '125.0.0.0',
      },
      http: {
        response: undefined,
        request: {
          body: undefined,
          bytes: '1024',
          id: 'test-cf-id',
          method: 'GET', // Add expected method here
          mime_type: 'application/json',
          referrer: 'https://example.com',
        },
        version: '1.1',
      },
      faas: {
        coldstart: true,
        execution: 'test-log-stream',
        id: 'test-function-arn',
        name: 'test-function',
        trigger: {
          request_id: 'test-request-id',
          type: 'http',
        },
        version: '1.0',
      },
    });
  });
});
