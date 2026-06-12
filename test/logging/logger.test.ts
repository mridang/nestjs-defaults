import { expect, jest, describe, test, beforeEach } from '@jest/globals';
import type { Ecs } from '@elastic/ecs';
import { ClsService } from 'nestjs-cls';
import { BetterLogger } from '../../src/logging/logger';
import { LogSink } from '../../src/logging/sink';
import { LogStrategy } from '../../src/logging/strategy';

class CapturingSink implements LogSink {
  public readonly entries: Ecs[] = [];

  emit(entry: Ecs): void {
    this.entries.push(entry);
  }
}

function makeCls(ctx: Partial<Ecs> | undefined): ClsService {
  return {
    get: jest.fn().mockReturnValue(ctx),
  } as unknown as ClsService;
}

describe('BetterLogger', () => {
  let sink: CapturingSink;
  let strategy: LogStrategy;

  beforeEach(() => {
    sink = new CapturingSink();
    strategy = {
      resource: {
        service: { name: 'birdlittle', version: '1.0.0' },
        cloud: { provider: 'cloudflare' },
      },
      sink,
    };
  });

  test('emits an ECS document carrying resource, message and log fields', () => {
    const logger = new BetterLogger(makeCls(undefined), strategy);

    logger.log('hello world', 'HomeController');

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]).toMatchObject({
      ecs: { version: expect.any(String) },
      service: { name: 'birdlittle', version: '1.0.0' },
      cloud: { provider: 'cloudflare' },
      message: 'hello world',
      log: { level: 'info', logger: 'HomeController' },
    });
    expect(sink.entries[0]['@timestamp']).toEqual(expect.any(String));
  });

  test('maps every NestJS level onto its ECS log.level', () => {
    const logger = new BetterLogger(makeCls(undefined), strategy);

    logger.log('a');
    logger.error('b');
    logger.warn('c');
    logger.debug('d');
    logger.verbose('e');
    logger.fatal('f');

    expect(sink.entries.map((entry) => entry.log?.level)).toEqual([
      'info',
      'error',
      'warn',
      'debug',
      'trace',
      'fatal',
    ]);
  });

  test('defaults the logger context when none is supplied', () => {
    const logger = new BetterLogger(makeCls(undefined), strategy);

    logger.log('no context here');

    expect(sink.entries[0].log?.logger).toEqual('Application');
  });

  test('shapes a thrown Error into ECS error fields', () => {
    const logger = new BetterLogger(makeCls(undefined), strategy);
    const failure = Object.assign(new Error('boom'), {
      code: 'E_BOOM',
      id: 'err-1',
    });
    failure.stack = 'stack-trace';

    logger.error('it failed', failure, 'PaymentService');

    expect(sink.entries[0]).toMatchObject({
      message: 'it failed',
      log: { logger: 'PaymentService' },
      error: {
        code: 'E_BOOM',
        id: 'err-1',
        message: 'boom',
        stack_trace: 'stack-trace',
        type: 'Error',
      },
    });
  });

  test('merges the request-scoped context from CLS', () => {
    const logger = new BetterLogger(
      makeCls({ url: { path: '/hook' }, faas: { coldstart: true } }),
      strategy,
    );

    logger.log('request handled');

    expect(sink.entries[0]).toMatchObject({
      url: { path: '/hook' },
      faas: { coldstart: true },
      service: { name: 'birdlittle' },
    });
  });

  test('does not emit when the level is disabled', () => {
    const logger = new BetterLogger(makeCls(undefined), strategy, ['error']);

    logger.debug('should be dropped');
    logger.error('should pass');

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].message).toEqual('should pass');
  });
});
