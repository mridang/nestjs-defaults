import { Injectable } from '@nestjs/common';
import {
  GetSecretValueCommand,
  GetSecretValueResponse,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

@Injectable()
export class SecretsService {
  private client: SecretsManagerClient = new SecretsManagerClient();
  private decoder = new TextDecoder('utf8');

  async loadSecrets(secretName: string): Promise<Record<string, string>> {
    const data: GetSecretValueResponse = await this.client.send(
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
