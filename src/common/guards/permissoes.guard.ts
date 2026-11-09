import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const PERMISSAO_KEY = 'bebfy:permissao';

export const ExigirPermissao = (permissao: string) => SetMetadata(PERMISSAO_KEY, permissao);

/**
 * Operators must receive explicit capabilities from their tenant manager.
 * Tenant managers and owners are allowed to perform administrative actions.
 */
@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissao = this.reflector.getAllAndOverride<string>(PERMISSAO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permissao) return true;

    const usuario = context.switchToHttp().getRequest().user;
    if (!usuario) throw new ForbiddenException('Sessão de acesso obrigatória.');
    if (['PROPRIETARIO', 'ADMINISTRADOR', 'GERENTE'].includes(usuario.cargo)) return true;
    if (Array.isArray(usuario.permissoes) && usuario.permissoes.includes(permissao)) return true;

    throw new ForbiddenException('Acesso negado: permissão ' + permissao + ' necessária.');
  }
}
