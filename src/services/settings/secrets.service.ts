import { Injectable } from '@nestjs/common';

/**
 * Loads secrets from AWS Secrets Manager.
 *
 * The AWS SDK is imported dynamically and the client is constructed lazily
 * inside `loadSecrets`, so merely instantiating this service (which Nest does
 * for every app that imports `SettingsModule`) never touches AWS. This keeps
 * the package usable on runtimes without the AWS SDK (e.g. Cloudflare Workers),
 * where `loadSecrets` is simply never called.
 */
@Injectable()
export class SecretsService {
  private decoder = new TextDecoder('utf8');

  async loadSecrets(secretName: string): Promise<Record<string, string>> {
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );

    const client = new SecretsManagerClient();
    const data = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );

    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    } else if (data.SecretBinary) {
      const buff = this.decoder.decode(data.SecretBinary);
      return JSON.parse(buff.toString());
    } else {
      throw new Error('No string or binary data found in the response');
    }
  }
}
