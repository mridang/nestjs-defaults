import { expect } from '@jest/globals';
import { BetterLogger } from '../src/logger';
import { ClsService } from 'nestjs-cls';
import { Writable } from 'stream';
import winston from 'winston';

describe('default.logger tests', () => {
  const sampleError = new Error('something went wrong');
  sampleError.stack = 'stack';

  function testLog(
    logMethod: keyof BetterLogger,
    logLevel: string,
    logMessage: string,
    ...extraProps: unknown[]
  ) {
    let logOutput = '';

    const stream = new Writable({
      write(chunk, _encoding, next) {
        logOutput += chunk.toString();
        next();
      },
    });

    const streamTransport = new winston.transports.Stream({ stream });
    const betterLogger = new BetterLogger(
      {
        get: jest.fn().mockReturnValue({ requestId: 'test-request-id' }),
      } as unknown as ClsService,
      ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'],
      {
        SERVICE_NAME: 'foo',
        AWS_LAMBDA_FUNCTION_NAME: 'bar',
        AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
        AWS_REGION: 'us-east-1',
        NODE_ENV: 'test',
      },
      {
        arch() {
          return 'arm64';
        },
        hostname() {
          return 'Mridangs-MacBook-Pro.local';
        },
        type() {
          return 'Darwin';
        },
        release() {
          return '23.0.0';
        },
        platform() {
          return 'darwin';
        },
        version() {
          return 'Darwin Kernel Version 23.0.0: Fri Sep 15 14:41:43 PDT 2023; root:xnu-10002.1.13~1/RELEASE_ARM64_T6000';
        },
      },
      streamTransport,
    );

    (
      betterLogger[logMethod] as (
        msg: string,
        ...optionalParams: unknown[]
      ) => void
    ).call(betterLogger, logMessage, ...extraProps);

    expect(JSON.parse(logOutput.trim())).toEqual({
      message: logMessage,
      level: logLevel,
      context: 'Unknown',
      requestId: 'test-request-id',
      ['@timestamp']: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      'log.level': logLevel,
      'log.logger': 'Unknown',
      'os.architecture': 'arm64',
      'os.hostname': 'Mridangs-MacBook-Pro.local',
      'os.id': 'Mridangs-MacBook-Pro.local',
      'os.name': 'Mridangs-MacBook-Pro.local',
      'os.os.family': 'Darwin',
      'os.os.full': 'Darwin 23.0.0',
      'os.os.kernel': '23.0.0',
      'os.os.name': 'Darwin',
      'os.os.platform': 'darwin',
      'os.os.type': 'darwin',
      'os.os.version':
        'Darwin Kernel Version 23.0.0: Fri Sep 15 14:41:43 PDT 2023; root:xnu-10002.1.13~1/RELEASE_ARM64_T6000',
      'os.type': 'unknown',
      'service.environment': 'test',
      'service.name': 'foo',
      'service.version': '$LATEST',
      'cloud.account.id': '123456789012',
      'cloud.account.name': 'my-aws-account',
      'cloud.availability_zone': 'us-east-1a',
      'cloud.instance.id': 'i-1234567890abcdef0',
      'cloud.instance.name': 'my-instance',
      'cloud.machine.type': 't2.medium',
      'cloud.provider': 'aws',
      'cloud.region': 'us-east-1',
      'cloud.service.name': 'lambda',
      error: extraProps.find((param) => param instanceof Error)
        ? {
            message: 'something went wrong',
            stack_trace: 'stack',
            type: 'Error',
          }
        : undefined,
    });
  }

  test('should log info messages to the console in JSON format', () => {
    testLog('log', 'info', 'Test log message');
  });

  test('should log info messages with an error to the console in JSON format', () => {
    testLog('log', 'info', 'Test log message', 'baz', sampleError, {
      foo: 'bar',
    });
  });

  test('should log debug messages to the console in JSON format', () => {
    testLog('debug', 'debug', 'Test debug message');
  });

  test('should log debug messages with an error to the console in JSON format', () => {
    testLog('debug', 'debug', 'Test debug message', 'baz', sampleError, {
      foo: 'bar',
    });
  });

  test('should log verbose messages to the console in JSON format', () => {
    testLog('verbose', 'verbose', 'Test verbose message');
  });

  test('should log verbose messages with an error to the console in JSON format', () => {
    testLog('verbose', 'verbose', 'Test verbose message', 'baz', sampleError, {
      foo: 'bar',
    });
  });

  test('should log error messages to the console in JSON format', () => {
    testLog('error', 'error', 'Test error message');
  });

  test('should log error messages with an error to the console in JSON format', () => {
    testLog('error', 'error', 'Test error message', 'baz', sampleError, {
      foo: 'bar',
    });
  });

  test('should log warning messages to the console in JSON format', () => {
    testLog('warn', 'warn', 'Test warn message');
  });

  test('should log warning messages to the console in JSON format', () => {
    testLog('warn', 'warn', 'Test warn message', 'baz', sampleError, {
      foo: 'bar',
    });
  });
});
