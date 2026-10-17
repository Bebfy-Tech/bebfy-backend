import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Habilita CORS para o Frontend (Vite/React) conseguir fazer requisições sem bloqueio
  app.enableCors();

  // 2. Habilita a validação e transformação automática de DTOs globalmente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 3. Configuração da documentação interativa com Swagger
  const config = new DocumentBuilder()
    .setTitle('Bebfy API')
    .setDescription('API RESTful do sistema de gestão Bebfy para distribuidoras e conveniências')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`\n🚀 Servidor NestJS rodando em: http://localhost:${port}`);
  console.log(`📖 Documentação Swagger disponível em: http://localhost:${port}/api\n`);
}
bootstrap();