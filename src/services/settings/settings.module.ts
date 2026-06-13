import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvSecretsSource, SecretsSource } from './source.js';

/**
 * Wrap resolved secrets in a config-load factory carrying a stable token.
 *
 * Without an explicit `.KEY`, `@nestjs/config` mints one with
 * `crypto.randomUUID()` at module-definition time, a forbidden global-scope
 * operation on Cloudflare Workers that prevents the app from booting at the top
 * level.
 *
 * @param secrets The resolved secrets.
 * @returns A keyed configuration-load factory.
 */
function stableConfigLoader(
  secrets: Record<string, string>,
): (() => Record<string, string>) & { KEY: string } {
  const loader = (() => secrets) as (() => Record<string, string>) & {
    KEY: string;
  };
  loader.KEY = 'CONFIGURATION(nestjs-defaults)';
  return loader;
}

/**
 * Loads configuration secrets from a {@link SecretsSource} and exposes them
 * through `@nestjs/config`.
 */
@Global()
@Module({})
export class SettingsModule {
  /**
   * Resolve secrets from the given source and register the configuration module.
   *
   * @param source Where secrets are loaded from. Defaults to the environment,
   *   which is correct for Cloudflare Workers and local development.
   * @returns The configured dynamic module.
   */
  static async register(source: SecretsSource = new EnvSecretsSource()) {
    const secrets = await source.load();

    return {
      module: SettingsModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [stableConfigLoader(secrets)],
        }),
      ],
    };
  }
}
