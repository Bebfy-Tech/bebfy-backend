// Importa o ValidationPipe para tratamento e validação dos DTOs
import { ValidationPipe } from '@nestjs/common';
// Importa o NestFactory para inicializar a aplicação NestJS
import { NestFactory } from '@nestjs/core';
// Importa o módulo raiz da aplicação
import { AppModule } from './app.module';

async function bootstrap() {
  // Cria a instância da aplicação NestJS a partir do AppModule
  const app = await NestFactory.create(AppModule);

  // Habilita o CORS (Cross-Origin Resource Sharing)
  // Essencial para permitir que o Frontend em React/Vite faça requisições para a API sem bloqueios do navegador
  app.enableCors();

  // Aplica o ValidationPipe globalmente para validar todas as requisições da API
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove do body qualquer propriedade que não esteja declarada no DTO
      forbidNonWhitelisted: true, // Retorna erro 400 se o cliente enviar campos não autorizados no JSON
      transform: true, // Converte automaticamente os tipos de dados da requisição (ex: string para number quando indicado)
    }),
  );

  // Define a porta do servidor obtendo das variáveis de ambiente (.env) ou usando a 3000 por padrão
  const port = process.env.PORT || 3000;

  // Inicia o servidor HTTP na porta configurada
  await app.listen(port);
  console.log(`🚀 Servidor Bebfy rodando com sucesso na porta: ${port}`);
}

// Executa a função de inicialização da aplicação
bootstrap();