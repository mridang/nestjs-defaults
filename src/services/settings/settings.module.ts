import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsService } from './secrets.service';

@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SettingsModule {
  static async register(secretName: string) {
    const secretLoaderService = new SecretsService();
    const secrets =
      process.env.NODE_ENV === 'production'
        ? await secretLoaderService.loadSecrets(secretName)
        : [];

    return {
      module: SettingsModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => secrets],
        }),
      ],
    };
  }
}
