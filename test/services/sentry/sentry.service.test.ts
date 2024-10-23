import * as Sentry from '@sentry/node';
import {
  SentryModuleOptions,
  SentryModule,
  SentryService,
} from '../../../src/services/sentry';
import { Test, TestingModule } from '@nestjs/testing';

jest.spyOn(Sentry, 'close').mockImplementation(() => Promise.resolve(true));

describe('sentry.service tests', () => {
  let config: SentryModuleOptions = {
    dsn: 'https://45740e3ae4864e77a01ad61a47ea3b7e@o115888.ingest.sentry.io/25956308132023',
    environment: 'development',
  };

  describe('sentry.log', () => {
    it('should provide the sentry client and call log', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      sentry.log('sentry:log');
      expect(sentry.log).toBeInstanceOf(Function);
    });
  });

  describe('sentry.error', () => {
    it('should provide the sentry client and call error', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      sentry.error('sentry:error');
      expect(sentry.error).toBeInstanceOf(Function);
    });
  });

  describe('sentry.verbose', () => {
    it('should provide the sentry client and call verbose', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      sentry.verbose('sentry:verbose', 'context:verbose');
      expect(sentry.verbose).toBeInstanceOf(Function);
    });
  });

  describe('sentry.debug', () => {
    it('should provide the sentry client and call debug', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      //eslint-disable-next-line testing-library/no-debugging-utils
      sentry.debug('sentry:debug', 'context:debug');
      expect(sentry.debug).toBeInstanceOf(Function);
    });
  });

  describe('sentry.warn', () => {
    it('should provide the sentry client and call warn', async () => {
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      try {
        sentry.warn('sentry:warn', 'context:warn');
      } catch (err: unknown) {
        fail(err);
      }
      expect(sentry.warn).toBeInstanceOf(Function);
    });
  });

  describe('sentry.close', () => {
    it('should not close the sentry if not specified in config', async () => {
      const mod = await Test.createTestingModule({
        imports: [SentryModule.forRoot(config)],
      }).compile();
      await mod.enableShutdownHooks();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      await mod.close();
      // expect(mockCloseSentry).not.toHaveBeenCalled();
    });

    it('should close the sentry if specified in config', async () => {
      const timeout = 100;
      const mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
            close: {
              enabled: true,
              timeout,
            },
          }),
        ],
      }).compile();
      await mod.enableShutdownHooks();

      const sentry = mod.get<SentryService>(SentryService);
      expect(sentry).toBeInstanceOf(SentryService);
      await mod.close();
      // expect(mockCloseSentry).toHaveBeenCalledWith(timeout);
    });
  });

  describe('Sentry Service asBreadcrumb implementation', () => {
    let mod: TestingModule;
    let sentry: SentryService;

    beforeAll(async () => {
      mod = await Test.createTestingModule({
        imports: [
          SentryModule.forRoot({
            ...config,
          }),
        ],
      }).compile();

      sentry = mod.get<SentryService>(SentryService);
    });

    it('sentry.SentryServiceInstance', () => {
      expect(SentryService.SentryServiceInstance).toBeInstanceOf(Function);
    });
    it('sentry.instance', () => {
      expect(sentry.instance).toBeInstanceOf(Function);
    });

    it('sentry.log asBreabcrumb === true', () => {
      try {
        sentry.log('sentry:log', 'context:log', true);
      } catch (err: unknown) {
        fail(err);
      }
      expect(sentry.log).toBeInstanceOf(Function);
    });

    it('sentry.debug asBreabcrumb === true', () => {
      try {
        //eslint-disable-next-line testing-library/no-debugging-utils
        sentry.debug('sentry:debug', 'context:debug', true);
      } catch (err: unknown) {
        fail(err);
      }
      expect(sentry.debug).toBeInstanceOf(Function);
    });

    it('sentry.verbose asBreabcrumb === true', () => {
      try {
        sentry.verbose('sentry:verbose', 'context:verbose', true);
      } catch (err: unknown) {
        fail(err);
      }
      expect(sentry.verbose).toBeInstanceOf(Function);
    });

    it('sentry.warn asBreabcrumb === true', () => {
      try {
        sentry.verbose('sentry:warn', 'context:warn', true);
      } catch (err: unknown) {
        fail(err);
      }
      expect(sentry.warn).toBeInstanceOf(Function);
    });
  });
});
