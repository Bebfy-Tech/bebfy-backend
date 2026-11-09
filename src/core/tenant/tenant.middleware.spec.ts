import { describe, expect, it, vi } from 'vitest';
import { TenantMiddleware } from './tenant.middleware';

describe('TenantMiddleware: frontends e api central', () => {
  const empresa = { id: 3, slug: 'adega-test', status: 'ATIVA' };
  const prisma = { empresa: { findFirst: vi.fn().mockResolvedValue(empresa) } };
  const middleware = new TenantMiddleware(prisma as any);

  it('usa x-tenant em vez de interpretar api.bebfy.com.br como loja', async () => {
    const req: any = {
      headers: { host: 'api.bebfy.com.br', 'x-tenant': 'adega-test' },
    };
    const next = vi.fn();
    await middleware.use(req, {} as any, next);
    expect(req.empresa?.id).toBe(3);
    expect(prisma.empresa.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ subdominio: 'adega-test' }, { slug: 'adega-test' }] },
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('não inventa tenant pelo domínio api sem configuração', async () => {
    const req: any = { headers: { host: 'api.bebfy.com.br' } };
    const next = vi.fn();
    await middleware.use(req, {} as any, next);
    expect(req.empresa).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });
});
