import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

const context = (request: any): any => ({
  switchToHttp: () => ({ getRequest: () => request }),
});

describe('TenantGuard', () => {
  const guard = new TenantGuard();

  it('rejeita requisição sem JWT', () => {
    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
  });

  it('rejeita empresa do host diferente do JWT', () => {
    expect(() => guard.canActivate(context({
      user: { empresaId: 2 }, empresa: { id: 1 },
    }))).toThrow(UnauthorizedException);
  });

  it('aceita tenant correto e o copia da sessão', () => {
    const request = { user: { empresaId: 2 }, empresa: { id: 2 }, empresaId: 0 };
    expect(guard.canActivate(context(request))).toBe(true);
    expect(request.empresaId).toBe(2);
  });
});
