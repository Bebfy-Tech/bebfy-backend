import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { SuporteService } from './suporte.service';

describe('SuporteService: access scoping and expiry', () => {
  it('blocks sessions of another platform administrator', async () => {
    const prisma: any = {
      sessaoSuporte: { findUnique: vi.fn().mockResolvedValue({
        id: 's1', administradorId: 'admin-A', empresaId: 1,
        expiraEm: new Date(Date.now() + 60000), revogadoEm: null,
      }) },
    };
    await expect(new SuporteService(prisma).diagnostico('admin-B', 's1'))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.sessaoSuporte.findUnique).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('blocks expired support access even if the URL is known', async () => {
    const prisma: any = {
      sessaoSuporte: { findUnique: vi.fn().mockResolvedValue({
        id: 's1', administradorId: 'admin-A', empresaId: 1,
        expiraEm: new Date(Date.now() - 1000), revogadoEm: null,
      }) },
    };
    await expect(new SuporteService(prisma).diagnostico('admin-A', 's1'))
      .rejects.toThrow(ForbiddenException);
  });

  it('blocks revoked sessions', async () => {
    const prisma: any = {
      sessaoSuporte: { findUnique: vi.fn().mockResolvedValue({
        id: 's1', administradorId: 'admin-A', empresaId: 1,
        expiraEm: new Date(Date.now() + 60000), revogadoEm: new Date(),
      }) },
    };
    await expect(new SuporteService(prisma).diagnostico('admin-A', 's1'))
      .rejects.toThrow(ForbiddenException);
  });

  it('provides aggregated diagnostics without CPF, secrets or transactions', async () => {
    const sessao = {
      id: 's1', empresaId: 1, administradorId: 'admin-A', ticket: 'SUP-2026',
      expiraEm: new Date(Date.now() + 60000), revogadoEm: null,
    };
    const tx: any = {
      empresa: { findUnique: vi.fn().mockResolvedValue({ id: 1, nomeFantasia: 'A', status: 'ATIVA', plano: null }) },
      produto: { count: vi.fn().mockResolvedValue(8) },
      funcionario: { count: vi.fn().mockResolvedValue(2) },
      cliente: { count: vi.fn().mockResolvedValue(4) },
      caixa: { count: vi.fn().mockResolvedValue(1) },
      venda: { count: vi.fn().mockResolvedValue(11) },
      logAuditoria: { create: vi.fn().mockResolvedValue({ id: 'log' }) },
    };
    const prisma: any = {
      sessaoSuporte: { findUnique: vi.fn().mockResolvedValue(sessao) },
      $transaction: vi.fn((fn: any) => fn(tx)),
    };
    const resultado = await new SuporteService(prisma).diagnostico('admin-A', 's1');
    expect(resultado.dadosAgregados).toEqual({ produtos: 8, funcionarios: 2, clientes: 4, caixasAbertos: 1, vendas: 11 });
    expect(resultado).not.toHaveProperty('cpf');
    expect(JSON.stringify(resultado)).not.toContain('senha');
    expect(tx.logAuditoria.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ acao: 'SUPORTE_DIAGNOSTICO_CONSULTADO', empresaId: 1, usuarioId: 'admin-A' }),
    }));
  });
});
