import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Configuração de CORS (suporte a subdomínios do Bebfy e ambiente local)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-tenant, x-subdominio',
  });

  // 2. Validação e Sanitização Global de DTOs
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

  // 3. Documentação Swagger
  const config = new DocumentBuilder()
    .setTitle('Bebfy API')
    .setDescription('API Backend Multi-tenant para Gestão de Distribuidoras e Varejo de Bebidas')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 Bebfy Backend executando com sucesso na porta ${port}`);
  console.log(`📄 Documentação Swagger disponível em: http://localhost:${port}/api/docs\n`);
}

bootstrap();