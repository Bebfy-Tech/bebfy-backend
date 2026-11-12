import { afterEach, describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { SaasSuperAdminGuard } from './saas-super-admin.guard';

const context = (user: any): any => ({
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

describe('SaasSuperAdminGuard', () => {
  const old = process.env.SAAS_ADMIN_USER_IDS;
  afterEach(() => {
    if (old === undefined) delete process.env.SAAS_ADMIN_USER_IDS;
    else process.env.SAAS_ADMIN_USER_IDS = old;
  });

  it('nega por padrão sem lista de administradores de plataforma', () => {
    delete process.env.SAAS_ADMIN_USER_IDS;
    expect(() => new SaasSuperAdminGuard().canActivate(context({ id: 'u1', cargo: 'ADMINISTRADOR' })))
      .toThrow(ForbiddenException);
  });

  it('aceita apenas IDs explicitamente permitidos', () => {
    process.env.SAAS_ADMIN_USER_IDS = 'root1, root2';
    expect(new SaasSuperAdminGuard().canActivate(context({ id: 'root2' }))).toBe(true);
    expect(() => new SaasSuperAdminGuard().canActivate(context({ id: 'other' })))
      .toThrow(ForbiddenException);
  });
});
