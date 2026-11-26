import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erro interno no banco de dados.';

    switch (exception.code) {
      case 'P2002': // Violação de chave única (Unique constraint)
        status = HttpStatus.BAD_REQUEST;
        message = 'Já existe um registro com estes dados.';
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
        this.logger.error('Falha de banco: '+exception.code,exception.stack);
        message = 'Erro interno no banco de dados.';
        break;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().path,
      message,
    });
  }
}