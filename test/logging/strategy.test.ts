import { expect, describe, test } from '@jest/globals';
import { HostInfo, selectStrategy } from '../../src/logging/strategy';
import {
  PrettyConsoleSink,
  StdoutJsonSink,
  StructuredConsoleSink,
} from '../../src/logging/sink';

const host: HostInfo = {
  arch: () => 'arm64',
  hostname: () => 'runner-1',
  type: () => 'Linux',
  release: () => '6.1.0',
  platform: () => 'linux',
  version: () => '#1 SMP',
};

describe('selectStrategy', () => {
  test('Cloudflare Workers: cloudflare resource, no host, structured console', () => {
    const strategy = selectStrategy({
      onCloudflareWorkers: true,
      env: {
        SERVICE_NAME: 'birdlittle',
        SERVICE_VERSION: 'cloudflare',
        NODE_ENV: 'production',
      },
    });

    expect(strategy.sink).toBeInstanceOf(StructuredConsoleSink);
    expect(strategy.resource).toMatchObject({
      service: { name: 'birdlittle', version: 'cloudflare' },
      cloud: { provider: 'cloudflare', service: { name: 'workers' } },
    });
    expect(strategy.resource.host).toBeUndefined();
  });

  test('Node production: host fields, env cloud metadata, stdout JSON', () => {
    const strategy = selectStrategy({
      onCloudflareWorkers: false,
      host,
      env: {
        NODE_ENV: 'production',
        SERVICE_NAME: 'api',
        CLOUD_PROVIDER: 'gcp',
        CLOUD_REGION: 'europe-west1',
      },
    });

    expect(strategy.sink).toBeInstanceOf(StdoutJsonSink);
    expect(strategy.resource).toMatchObject({
      service: { name: 'api' },
      host: {
        architecture: 'arm64',
        hostname: 'runner-1',
        os: { name: 'Linux', kernel: '6.1.0', platform: 'linux' },
      },
      cloud: { provider: 'gcp', region: 'europe-west1' },
    });
  });

  test('Node development: pretty console sink', () => {
    const strategy = selectStrategy({
      onCloudflareWorkers: false,
      host,
      env: { NODE_ENV: 'test', SERVICE_NAME: 'api' },
    });

    expect(strategy.sink).toBeInstanceOf(PrettyConsoleSink);
  });

  test('contains no AWS-named field literals', () => {
    const node = selectStrategy({
      onCloudflareWorkers: false,
      host,
      env: { NODE_ENV: 'production' },
    });
    const workers = selectStrategy({
      onCloudflareWorkers: true,
      env: { NODE_ENV: 'production' },
    });

    const serialised = JSON.stringify([node.resource, workers.resource]);
    expect(serialised.toLowerCase()).not.toContain('aws');
    expect(serialised.toLowerCase()).not.toContain('lambda');
  });
});
