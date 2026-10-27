import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentEmpresa = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();

    // 1. Tenta pegar do usuário autenticado via JWT
    if (request.user && request.user.empresaId) {
      return Number(request.user.empresaId);
    }

    // 2. Se não houver JWT ainda (ex: rota pública), pega do Middleware de Tenant
    if (request.empresa && request.empresa.id) {
      return Number(request.empresa.id);
    }

    // 3. Fallback de segurança ou exceção
    throw new UnauthorizedException(
      'Não foi possível identificar a empresa da requisição.',
    );
  },
);