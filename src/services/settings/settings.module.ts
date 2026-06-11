import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsService } from './secrets.service';

/**
 * Where configuration secrets come from.
 *
 * - `'aws'` (default): load from AWS Secrets Manager when `NODE_ENV` is
 *   `production` (the historical behaviour).
 * - a plain object: use the given key/value pairs directly. Use this on
 *   Cloudflare Workers, passing the Worker `env` bindings.
 * - a function: called once at boot to produce the key/value pairs (sync or
 *   async). Use for any custom secret source.
 */
export type SecretsSource =
  | 'aws'
  | Record<string, string>
  | (() => Promise<Record<string, string>> | Record<string, string>);

@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SettingsModule {
  static async register(secretName: string, source: SecretsSource = 'aws') {
    let secrets: Record<string, string> = {};

    if (typeof source === 'function') {
      secrets = await source();
    } else if (typeof source === 'object') {
      secrets = source;
    } else if (source === 'aws' && process.env.NODE_ENV === 'production') {
      secrets = await new SecretsService().loadSecrets(secretName);
    }

    // Give the load factory a stable token. Without `.KEY`, @nestjs/config
    // mints one with crypto.randomUUID() at module-definition time, which is a
    // forbidden global-scope operation on Cloudflare Workers and prevents the
    // app from booting at the top level.
    const loadConfig: (() => Record<string, string>) & { KEY?: string } = () =>
      secrets;
    loadConfig.KEY = 'CONFIGURATION(nestjs-defaults)';

    return {
      module: SettingsModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [loadConfig],
        }),
      ],
    };
  }
}
