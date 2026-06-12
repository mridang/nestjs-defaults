import { expect, describe, test } from '@jest/globals';
import {
  AwsSecretsManagerSource,
  EnvSecretsSource,
} from '../../../src/services/settings/source';

describe('EnvSecretsSource', () => {
  test('resolves to an empty map (secrets live in the environment)', async () => {
    await expect(new EnvSecretsSource().load()).resolves.toEqual({});
  });
});

describe('AwsSecretsManagerSource.load', () => {
  test('requests the secret by id and returns the parsed bundle', async () => {
    const sent: Array<{ SecretId: string }> = [];

    class FakeCommand {
      constructor(public readonly input: { SecretId: string }) {}
    }

    class FakeClient {
      send(command: object): Promise<{ SecretString: string }> {
        sent.push((command as FakeCommand).input);
        return Promise.resolve({ SecretString: '{"TOKEN":"abc"}' });
      }
    }

    const loadSdk = async () => ({
      SecretsManagerClient: FakeClient,
      GetSecretValueCommand: FakeCommand,
    });

    const source = new AwsSecretsManagerSource('my-secret', loadSdk);

    await expect(source.load()).resolves.toEqual({ TOKEN: 'abc' });
    expect(sent).toEqual([{ SecretId: 'my-secret' }]);
  });
});

describe('AwsSecretsManagerSource.parse', () => {
  test('parses a JSON SecretString into a key/value map', () => {
    expect(
      AwsSecretsManagerSource.parse({
        SecretString: '{"TOKEN":"abc","PORT":"3000"}',
      }),
    ).toEqual({ TOKEN: 'abc', PORT: '3000' });
  });

  test('parses a binary secret payload', () => {
    const bytes = new TextEncoder().encode('{"KEY":"value"}');
    expect(AwsSecretsManagerSource.parse({ SecretBinary: bytes })).toEqual({
      KEY: 'value',
    });
  });

  test('throws when the response carries no data', () => {
    expect(() => AwsSecretsManagerSource.parse({})).toThrow(
      /no string or binary data/,
    );
  });
});
