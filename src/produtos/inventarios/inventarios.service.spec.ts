import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InventariosService } from './inventarios.service';

const data = new Date('2026-11-27T12:00:00Z');
function fixture(contagem: number | null = 7, saldo = 10, lotes = 0) {
  const inv = { id: 'inv', empresaId: 1, revisao: 0, status: 'ABERTO', itens: [{ produtoId: 2, nome: 'Produto', saldoInicial: 10, contagem, produtoAtualizadoEm: data }] };
  const tx = {
    inventarioEstoque: { findFirst: vi.fn().mockResolvedValue(inv), updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue(inv) },
    produto: { findMany: vi.fn().mockResolvedValue([{ id: 2, nome: 'Produto', estoqueAtual: saldo, atualizadoEm: data, _count: { lotes } }]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    movimentacaoEstoque: { create: vi.fn().mockResolvedValue({}) },
    itemInventarioEstoque: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { tx, service: new InventariosService(prisma as any) };
}
describe('InventariosService', () => {
  it('aplica diferença negativa e registra auditoria no histórico', async () => {
    const { tx, service } = fixture();
    await service.encerrar(1, 'inv', 0, 'Conferência', 'gestor');
    expect(tx.produto.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { estoqueAtual: 7 } }));
    expect(tx.movimentacaoEstoque.create).toHaveBeenCalledWith({ data: expect.objectContaining({ empresaId: 1, produtoId: 2, tipo: 'AJUSTE_SAIDA', quantidade: 3 }) });
  });
  it('não ajusta estoque com contagem pendente', async () => {
    const { tx, service } = fixture(null);
    await expect(service.encerrar(1, 'inv', 0, 'Conferência', 'gestor')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.produto.updateMany).not.toHaveBeenCalled();
  });
  it('rejeita saldo alterado durante a contagem', async () => {
    const { tx, service } = fixture(7, 9);
    await expect(service.encerrar(1, 'inv', 0, 'Conferência', 'gestor')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.movimentacaoEstoque.create).not.toHaveBeenCalled();
  });
  it('bloqueia divergência em produto com lote', async () => {
    const { tx, service } = fixture(7, 10, 1);
    await expect(service.encerrar(1, 'inv', 0, 'Conferência', 'gestor')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.produto.updateMany).not.toHaveBeenCalled();
  });
  it('rejeita revisão obsoleta', async () => {
    const { tx, service } = fixture();
    tx.inventarioEstoque.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.salvar(1, 'inv', 0, [{ produtoId: 2, contagem: 5 }], 'operador')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.itemInventarioEstoque.update).not.toHaveBeenCalled();
  });
  it('consulta sempre pelo tenant e rejeita inventário inexistente', async () => {
    const { tx, service } = fixture();
    tx.inventarioEstoque.findFirst.mockResolvedValue(null);
    await expect(service.ficha(99, 'inv')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.inventarioEstoque.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv', empresaId: 99 } }));
  });
  it('cancela sem alterar o estoque', async () => {
    const { tx, service } = fixture(null);
    await service.encerrar(1, 'inv', 0, 'Cancelamento', 'gestor', true);
    expect(tx.produto.updateMany).not.toHaveBeenCalled();
    expect(tx.inventarioEstoque.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELADO' }) }));
  });
});
