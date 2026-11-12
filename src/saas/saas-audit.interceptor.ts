import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class SaasAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SaasAuditInterceptor.name);
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string; originalUrl: string; body?: Record<string, unknown>;
      params?: Record<string, string>; saasUser?: { id: string };
    }>();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) || !req.saasUser?.id) {
      return next.handle();
    }
    const actor = req.saasUser.id;
    const metodo = req.method;
    const rota = (req.originalUrl || '').split('?')[0].slice(0, 250);
    // Log only top-level field names. Never persist any credential or payload value.
    const campos = Object.keys(req.body || {})
      .filter(name => !/senha|password|secret|token|jwt|credential|authorization/i.test(name))
      .slice(0, 40);
    const recursoId = req.params?.id || req.params?.cobrancaId || null;
    return next.handle().pipe(mergeMap(async value => {
      try {
        await this.prisma.saasAuditoria.create({
          data: { operadorId: actor, metodo, rota, campos, recursoId },
        });
      } catch (error) {
        // Do not turn a completed mutation into an error response.
        this.logger.error('Falha ao registrar auditoria administrativa', error);
      }
      return value;
    }));
  }
}
