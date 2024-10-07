import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import {
  SentryModule,
  SentryService,
  InjectSentry,
} from '../../../src/services/sentry';

describe('inject.decorator test', () => {
  let module: TestingModule;

  @Injectable()
  class InjectableService {
    public constructor(@InjectSentry() public readonly client: SentryService) {
      //
    }
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SentryModule.forRoot({
          dsn: 'https://45740e3ae4864e77a01ad61a47ea3b7e@o115888.ingest.sentry.io/25956308132021',
          environment: 'development',
        }),
      ],
      providers: [InjectableService],
    }).compile();
  });

  describe('when decorating a class constructor parameter', () => {
    it('should inject the sentry client', () => {
      const testService = module.get(InjectableService);
      expect(testService.client).toBeInstanceOf(SentryService);
    });
  });
});
