import { Test } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import {
  SentryModuleOptions,
  SentryOptionsFactory,
  SentryModule,
  SentryService,
  SENTRY_TOKEN,
} from '../../../src/services/sentry';

describe('sentry.module tests', () => {
  let config: SentryModuleOptions = {
    dsn: 'https://45740e3ae4864e77a01ad61a47ea3b7e@o115888.ingest.sentry.io/25956308132022',
    environment: 'development',
  };

  class TestService implements SentryOptionsFactory {
    createSentryModuleOptions(): SentryModuleOptions {
      return config;
    }
  }

  @Module({
    exports: [TestService],
    providers: [TestService],
  })
  class TestModule {
    //
  }

  describe('forRoot', () => {
    it('should provide the sentry client', async () => {
      const mod = await Test.createTestingModule({
        imports: [SentryModule.forRoot(config)],
      }).compile();

      expect(mod.get<SentryService>(SENTRY_TOKEN)).toBeInstanceOf(
        SentryService,
      );
    });
  });

  describe('forRootAsync', () => {
    describe('when the `useFactory` option is used', () => {
      it('should provide sentry client', async () => {
        const mod = await Test.createTestingModule({
          imports: [
            SentryModule.forRootAsync({
              useFactory: () => config,
            }),
          ],
        }).compile();

        expect(mod.get<SentryService>(SENTRY_TOKEN)).toBeInstanceOf(
          SentryService,
        );
      });
    });
  });

  describe('when the `useClass` option is used', () => {
    it('should provide the sentry client', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRootAsync({
            useClass: TestService,
          }),
        ],
      }).compile();

      expect(mod.get<SentryService>(SENTRY_TOKEN)).toBeInstanceOf(
        SentryService,
      );
    });
  });

  describe('when the `useExisting` option is used', () => {
    it('should provide the stripe client', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRootAsync({
            imports: [TestModule],
            useExisting: TestService,
          }),
        ],
      }).compile();

      expect(mod.get<SentryService>(SENTRY_TOKEN)).toBeInstanceOf(
        SentryService,
      );
    });
  });
});
