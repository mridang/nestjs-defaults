/**
 * @file Verifies that the optional framework peers the library targets resolve.
 */
import { describe, expect, it } from '@jest/globals';
import { CacheModule } from '@nestjs/cache-manager';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';

describe('peer modules', () => {
  it.each([
    ['@nestjs/cache-manager', CacheModule],
    ['@nestjs/cqrs', CqrsModule],
    ['@nestjs/jwt', JwtModule],
  ])('resolves %s', (_name, mod) => {
    expect(mod).toBeDefined();
  });
});
