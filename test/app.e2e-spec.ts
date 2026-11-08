import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('AppController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        empresa: {
          findFirst: async () => null,
        },
        $connect: async () => {},
        $disconnect: async () => {},
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET) - Deve responder a requisição no endpoint raiz', async () => {
    const response = await request(app.getHttpServer()).get('/');

    expect([200, 404]).toContain(response.status);
  });

  it('/rota-inexistente (GET) - Deve retornar 404 padronizado pelo AllExceptionsFilter', async () => {
    const response = await request(app.getHttpServer()).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('statusCode', 404);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('path', '/rota-inexistente');
  });
});