import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExigirModulo, ModuloAtivoGuard } from './modulo-ativo.guard';

class TestEndpoint {
  @ExigirModulo('FIADOS')
  action() {}
}
function context(empresaId?: number): any {
  return {
    getHandler: () => TestEndpoint.prototype.action,
    getClass: () => TestEndpoint,
    switchToHttp: () => ({ getRequest: () => ({ user: { empresaId } }) }),
  };
}

describe('ModuloAtivoGuard', () => {
  it('aceita módulos ainda não configurados de clientes existentes', async () => {
    const prisma: any = { empresaModulo: { findUnique: vi.fn().mockResolvedValue(null) } };
    const guard = new ModuloAtivoGuard(new Reflector(), prisma);
    await expect(guard.canActivate(context(1))).resolves.toBe(true);
  });

  it('impede módulo explicitamente desativado para a empresa', async () => {
    const prisma: any = { empresaModulo: { findUnique: vi.fn().mockResolvedValue({ ativo: false }) } };
    const guard = new ModuloAtivoGuard(new Reflector(), prisma);
    await expect(guard.canActivate(context(3))).rejects.toThrow(ForbiddenException);
    expect(prisma.empresaModulo.findUnique).toHaveBeenCalledWith({
      where: { empresaId_modulo: { empresaId: 3, modulo: 'FIADOS' } },
      select: { ativo: true },
    });
  });

  it('rejeita usuário sem empresa mesmo para um módulo atribuído', async () => {
    const prisma: any = { empresaModulo: { findUnique: vi.fn() } };
    await expect(new ModuloAtivoGuard(new Reflector(), prisma).canActivate(context()))
      .rejects.toThrow(ForbiddenException);
  });

  it('aceita módulo habilitado para a empresa', async () => {
    const prisma: any = { empresaModulo: { findUnique: vi.fn().mockResolvedValue({ ativo: true }) } };
    await expect(new ModuloAtivoGuard(new Reflector(), prisma).canActivate(context(2)))
      .resolves.toBe(true);
  });
});
