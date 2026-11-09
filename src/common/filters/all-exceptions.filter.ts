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
      path: request.url,
      method: request.method,
      error: message,
    };

    this.logger.error(
      `${request.method} ${request.url} - Status ${status} - Error: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json(errorBody);
  }
}