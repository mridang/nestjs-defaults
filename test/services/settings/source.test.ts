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
