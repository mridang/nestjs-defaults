/**
 * @file Tests for the secrets sources, covering the environment source and AWS Secrets Manager parsing.
 */
import { expect, describe, test } from '@jest/globals';
import {
  AwsSecretsManagerSource,
  EnvSecretsSource,
} from '../../../src/services/settings/source.js';

/** Matches the error message for a source that returns no data. */
const NO_DATA_MESSAGE_PATTERN = /no string or binary data/u;

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
      async send(command: FakeCommand): Promise<{ SecretString: string }> {
        sent.push(command.input);
        return { SecretString: '{"TOKEN":"abc"}' };
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
      NO_DATA_MESSAGE_PATTERN,
    );
  });
});
