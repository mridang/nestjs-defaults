/**
 * A source of configuration secrets.
 *
 * Each runtime keeps secrets in a different place — AWS in Secrets Manager,
 * Cloudflare Workers in the environment — so the source is the seam that lets
 * the settings layer load them without knowing which provider is in use.
 */
export interface SecretsSource {
  /**
   * Resolve the secrets as a flat key/value map.
   *
   * @returns The resolved secrets.
   */
  load(): Promise<Record<string, string>>;
}

/**
 * Secrets source for runtimes that inject secrets into the process environment,
 * such as Cloudflare Workers, where binding values are exposed on `process.env`.
 *
 * The configuration layer already reads the environment, so there is nothing to
 * fetch and this resolves to an empty map.
 */
export class EnvSecretsSource implements SecretsSource {
  /**
   * @returns An empty map; the environment is read by the configuration layer.
   */
  load(): Promise<Record<string, string>> {
    return Promise.resolve({});
  }
}

/**
 * A Secrets Manager response carrying the secret payload.
 */
interface SecretValue {
  SecretString?: string;
  SecretBinary?: Uint8Array;
}

/**
 * The subset of `@aws-sdk/client-secrets-manager` this source relies on.
 */
interface SecretsManagerSdk {
  SecretsManagerClient: new () => {
    send(command: object): Promise<SecretValue>;
  };
  GetSecretValueCommand: new (input: { SecretId: string }) => object;
}

/**
 * Load the AWS Secrets Manager SDK lazily, so the package only requires
 * `@aws-sdk/client-secrets-manager` when this source is actually used.
 *
 * @returns The Secrets Manager SDK.
 */
const loadSecretsManager = (): Promise<SecretsManagerSdk> =>
  import(
    '@aws-sdk/client-secrets-manager'
  ) as unknown as Promise<SecretsManagerSdk>;

/**
 * Secrets source that loads a JSON secret bundle from AWS Secrets Manager.
 */
export class AwsSecretsManagerSource implements SecretsSource {
  /**
   * @param secretId The identifier of the secret to load.
   * @param loadSdk Loader for the AWS SDK; defaults to a lazy dynamic import.
   */
  constructor(
    private readonly secretId: string,
    private readonly loadSdk: () => Promise<SecretsManagerSdk> = loadSecretsManager,
  ) {}

  /**
   * Fetch and parse the secret bundle from AWS Secrets Manager.
   *
   * @returns The secret key/value pairs.
   */
  async load(): Promise<Record<string, string>> {
    const { SecretsManagerClient, GetSecretValueCommand } =
      await this.loadSdk();

    const client = new SecretsManagerClient();
    const data = await client.send(
      new GetSecretValueCommand({ SecretId: this.secretId }),
    );

    return AwsSecretsManagerSource.parse(data);
  }

  /**
   * Parse a Secrets Manager response into a key/value map.
   *
   * @param data The Secrets Manager response.
   * @returns The parsed secret key/value pairs.
   */
  static parse(data: SecretValue): Record<string, string> {
    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    }
    if (data.SecretBinary) {
      return JSON.parse(new TextDecoder('utf8').decode(data.SecretBinary));
    }
    throw new Error('Secrets Manager returned no string or binary data');
  }
}
