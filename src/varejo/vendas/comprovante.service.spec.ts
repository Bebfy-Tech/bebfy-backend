import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ComprovanteService } from './comprovante.service';

describe('ComprovanteService (apenas não fiscal)', () => {
  const prisma = {
    venda: { findFirst: vi.fn() },
    empresa: { findUnique: vi.fn() },
  };
  const service = new ComprovanteService(prisma as any);

  it('não permite acesso a venda de outra empresa', async () => {
    prisma.venda.findFirst.mockResolvedValueOnce(null);
    prisma.empresa.findUnique.mockResolvedValueOnce({
      nomeFantasia: 'Loja A', config: null,
    });
    await expect(service.obter(1, 'id-de-outra-empresa')).rejects.toThrow(NotFoundException);
    expect(prisma.venda.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'id-de-outra-empresa', empresaId: 1 },
    }));
  });

  it('retorna os valores da venda com aviso não fiscal e sem autorização tributária', async () => {
    prisma.venda.findFirst.mockResolvedValueOnce({
      id: 'venda-1', codigoVenda: 123,
      criadoEm: new Date('2026-11-09T12:00:00Z'),
      status: 'CONCLUIDA',
      funcionario: { nome: 'Caixa' },
      cliente: { nome: 'Cliente teste' },
      subtotal: 25, desconto: 5, taxaEntrega: 0, valorTotal: 20,
      itens: [{
        quantidade: 2, precoUnitario: 12.5, precoTotal: 25,
        produto: { nome: 'Água mineral', unidadeMedida: 'UN' },
      }],
      pagamentos: [{ formaPagamento: 'PIX', valor: 20, troco: 0 }],
    });
    prisma.empresa.findUnique.mockResolvedValueOnce({
      nomeFantasia: 'Bebidas A',
      config: { telefone: '123456789', endereco: 'Rua A' },
    });

    const recibo = await service.obter(1, 'venda-1');
    expect(recibo.tipo).toBe('COMPROVANTE_NAO_FISCAL');
    expect(recibo.titulo).toBe('COMPROVANTE NÃO FISCAL');
    expect(recibo.aviso).toContain('Não substitui NFC-e ou NF-e');
    expect(recibo.valores.total).toBe(20);
    expect(recibo.itens[0].descricao).toBe('Água mineral');
    expect(recibo).not.toHaveProperty('chaveAcesso');
    expect(recibo).not.toHaveProperty('protocolo');
  });
});
