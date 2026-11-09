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

    if (request.empresa && request.empresa.id !== user.empresaId) {
      throw new UnauthorizedException('O domínio ou cabeçalho da empresa não corresponde à sessão autenticada.');
    }

    // A identidade do tenant nas operações autenticadas vem sempre do JWT.
    request.empresaId = user.empresaId;

    return true;
  }
}