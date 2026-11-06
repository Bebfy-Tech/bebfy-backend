import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Garante que a requisição passou pelo AuthGuard (JWT) e possui um payload válido
    if (!user || !user.empresaId) {
      throw new UnauthorizedException('Acesso negado: Contexto da empresa não identificado.');
    }

    // Opcional: Se o usuário enviar um empresaId no body/query por engano, sobredetermina com o do JWT
    request.empresaId = user.empresaId;

    return true;
  }
}