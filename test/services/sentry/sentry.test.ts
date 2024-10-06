import { Resolver, Query, GraphQLModule } from '@nestjs/graphql';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ApolloDriver } from '@nestjs/apollo';
import { HttpStatus } from '@nestjs/common';
import { GraphqlInterceptor, SentryModule } from '../../../src/services/sentry';

@Resolver()
class ExampleResolver {
  @Query(() => String, { nullable: true })
  async getEmptyResponse(): Promise<string> {
    return '';
  }

  @Query(() => String)
  async throwError(): Promise<string> {
    throw new Error('An error occurred');
  }
}

describe('sentry.e2e tests', () => {
  let testModule: NestExpressApplication;

  beforeAll(async () => {
    testModule = await Test.createTestingModule({
      imports: [
        SentryModule.forRoot({
          dsn: 'https://45740e3ae4864e77a01ad61a47ea3b7e@o115888.ingest.sentry.io/25956308132023',
          environment: 'development',
        }),
        GraphQLModule.forRoot({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useFactory: () => new GraphqlInterceptor(),
        },
        ExampleResolver,
      ],
    })
      .compile()
      .then((module) =>
        module.createNestApplication<NestExpressApplication>({
          rawBody: true,
        }),
      )
      .then((nest) => nest.init());
  });

  afterAll(async () => {
    await testModule?.close();
  });

  it('should return an empty response', async () => {
    return await request(testModule.getHttpServer())
      .post('/graphql')
      .send({
        query: '{ getEmptyResponse }',
      })
      .expect(HttpStatus.OK)
      .expect((response) => {
        expect(response.body.data.getEmptyResponse).toEqual('');
      });
  });

  it('should throw an error', async () => {
    return await request(testModule.getHttpServer())
      .post('/graphql')
      .send({
        query: '{ throwError }',
      })
      .expect(HttpStatus.OK)
      .expect((response) => {
        expect(response.body.errors[0].message).toBe('An error occurred');
      });
  });
});
