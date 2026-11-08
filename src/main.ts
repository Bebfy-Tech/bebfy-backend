import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './core/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Configuração de CORS (suporte ao ambiente local, subdomínios do Bebfy e frontend configurado no .env)
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-tenant, x-subdominio, x-empresa-id',
  });

  // 2. Validação e Sanitização Global de DTOs (Barrar dados malformados ou extras)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 3. Filtros Globais de Tratamento de Erros (AllExceptionsFilter para erros gerais + PrismaExceptionFilter para o Prisma)
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new PrismaExceptionFilter(),
  );

  // 4. Documentação Swagger com suporte a Autenticação Bearer (JWT)
  const config = new DocumentBuilder()
    .setTitle('Bebfy API')
    .setDescription(
      'Sistema SaaS de Gestão para Distribuidoras de Bebidas — API Multi-tenant',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Introduza o token JWT gerado no endpoint de login',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 Bebfy Backend executando com sucesso na porta ${port}`);
  console.log(`📄 Documentação Swagger disponível em: http://localhost:${port}/api\n`);
}

bootstrap();