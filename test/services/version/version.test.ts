/**
 * @file End-to-end tests for the version badge endpoint.
 */
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VersionModule } from '../../../src/services/version/version.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Matches an inline SVG document. */
const SVG_PATTERN = /<svg.*?svg>/u;

describe('version.e2e test', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [VersionModule],
    })
      .compile()
      .then((module) =>
        module.createNestApplication<NestExpressApplication>({
          rawBody: true,
        }),
      )
      .then(async (nest) => nest.init());
  });

  afterAll(async () => {
    await testModule.close();
  });

  test('that a bage is rendered when requested', () =>
    request(testModule.getHttpServer())
      .get('/version.svg')
      .expect(HttpStatus.OK)
      .expect('Content-Type', 'image/svg+xml; charset=utf-8')
      .expect((response) => {
        expect(String(response.body)).toMatch(SVG_PATTERN);
      }));
});
