/**
 * @file Shared end-to-end harness that builds a Nest application with the defaults configured.
 */
import {
  type INestApplication,
  Logger,
  type ModuleMetadata,
  type Provider,
  type Type,
} from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import configure from '../src/app';

/** One entry in a module's imports, as Nest accepts them. */
type ModuleImport = NonNullable<ModuleMetadata['imports']>[number];

/**
 * Builds a Nest application for end-to-end tests, with the defaults configured.
 */
export class End2EndModule {
  app!: INestApplication;
  private readonly imports: ModuleImport[];
  private readonly controllers: Type[];
  private readonly providers: Provider[];

  constructor(options: {
    imports?: ModuleImport[];
    providers?: Provider[];
    controllers?: Type[];
  }) {
    this.imports = options.imports ?? [];
    this.providers = options.providers ?? [];
    this.controllers = options.controllers ?? [];
  }

  async beforeAll(
    testFn: (testModule: TestingModuleBuilder) => TestingModuleBuilder = (
      testModule,
    ) => testModule,
  ): Promise<void> {
    const moduleFixture = await testFn(
      Test.createTestingModule({
        controllers: [...this.controllers],
        imports: [...this.imports],
        providers: [...this.providers],
      }).setLogger(new Logger()), // See https://stackoverflow.com/questions/71677866/
    ).compile();

    const nestApp = moduleFixture.createNestApplication<NestExpressApplication>(
      {
        rawBody: true,
      },
    );

    configure(nestApp);
    await nestApp.init();
    this.app = nestApp;
  }

  async afterAll(): Promise<void> {
    await this.app.close();
  }
}
