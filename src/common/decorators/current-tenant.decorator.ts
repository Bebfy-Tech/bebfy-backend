import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const empresaId = request.user?.empresaId;

    if (!empresaId) {
      throw new UnauthorizedException('Identificador da empresa (empresaId) não encontrado no token JWT.');
    }

    return Number(empresaId);
  },
);