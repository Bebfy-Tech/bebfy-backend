import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException, mixin } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../core/prisma/prisma.service';
import type { SaasPermission } from './saas-auth.service';

@Injectable()
export class SaasAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = req.headers.authorization;
    if (typeof raw !== 'string' || !raw.startsWith('Bearer ')) throw new UnauthorizedException('Sessão administrativa ausente.');
    let payload: { sub?: string; tipo?: string; sessaoId?: string };
    try { payload = await this.jwt.verifyAsync(raw.slice(7)); }
    catch { throw new UnauthorizedException('Sessão administrativa inválida ou expirada.'); }
    if (payload.tipo !== 'SAAS_ADMIN' || !payload.sub || !payload.sessaoId) {
      throw new UnauthorizedException('Credencial inválida para a administração SaaS.');
    }
    const user = await this.prisma.saasOperador.findUnique({ where: { id: payload.sub } });
    if (!user?.ativo || user.sessaoId !== payload.sessaoId) throw new UnauthorizedException('Sessão administrativa revogada.');
    req.saasUser = user;
    return true;
  }
}

export function SaasPermissionGuard(permission: SaasPermission) {
  @Injectable()
  class PermissionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const user = context.switchToHttp().getRequest().saasUser;
      if (!user || (user.cargo !== 'SUPER_ADMIN' && !user.permissoes.includes(permission))) {
        throw new ForbiddenException('Sua conta não possui essa permissão.');
      }
      return true;
    }
  }
  return mixin(PermissionGuard);
}
