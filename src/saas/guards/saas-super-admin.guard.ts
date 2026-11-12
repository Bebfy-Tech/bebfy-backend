import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Platform administration must not be granted merely because someone is
 * an ADMINISTRADOR of a tenant. IDs are provisioned out of band.
 * Empty configuration fails closed.
 */
@Injectable()
export class SaasSuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const allowed = (process.env.SAAS_ADMIN_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
    if (!request.user?.id || !allowed.includes(request.user.id)) {
      throw new ForbiddenException('Acesso restrito à administração global do Bebfy.');
    }
    return true;
  }
}
