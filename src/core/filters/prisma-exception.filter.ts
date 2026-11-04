import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno no banco de dados.';

    switch (exception.code) {
      case 'P2002': // Violação de chave única (Unique constraint)
        status = HttpStatus.BAD_REQUEST;
        const target = (exception.meta?.target as string[])?.join(', ') || 'campo';
        message = `Já existe um registro com este valor para o campo: ${target}.`;
        break;

      case 'P2025': // Registro não encontrado
        status = HttpStatus.NOT_FOUND;
        message = 'O registro solicitado não foi encontrado.';
        break;

      case 'P2003': // Violação de chave estrangeira
        status = HttpStatus.BAD_REQUEST;
        message = 'Operação inválida: violação de relacionamento com outros dados.';
        break;

      default:
        message = `Erro Prisma (${exception.code}): ${exception.message}`;
        break;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      message,
    });
  }
}