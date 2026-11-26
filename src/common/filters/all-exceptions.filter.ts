import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Erro interno no servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? res : { message: res };
    }
    // Do not disclose database details, stack traces or internal exception messages to clients.

    const errorBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      error: status >= 500 ? {message:'Erro interno no servidor'} : message,
    };

    // Log expected business conditions without stack traces or sensitive query parameters.
    const resumo = `${request.method} ${request.path} - Status ${status}`;
    if(status>=500)this.logger.error(resumo,exception instanceof Error?exception.stack:'');
    else if(status===409 && typeof message==='object' && 'codigo' in message && message.codigo==='SESSAO_ATIVA')this.logger.log(resumo+' - SESSAO_ATIVA');
    else this.logger.warn(resumo);
    
    response.status(status).json(errorBody);
  }
}