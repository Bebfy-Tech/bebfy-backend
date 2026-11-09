import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient, FormaPagamento } from '@prisma/client';
import { VendasService } from '../../src/varejo/vendas/vendas.service';
import { CaixaService } from '../../src/varejo/caixa/caixa.service';
import { CreateVendaDto } from '../../src/varejo/vendas/dto/create-venda.dto';

describe('PDV em PostgreSQL: isolamento, concorrência e caixa', () => {
  const prisma = new PrismaClient();
  const vendas = new VendasService(prisma as any);
  const caixaService = new CaixaService(prisma as any);
  let empresaId: number;
  let outroId: number;
  let funcionarioId: string;
  let caixaId: string;
  let produtoId: number;
  let produtoOutraEmpresa: number;

  beforeAll(async () => {
    await prisma.$connect();
    const marcador = randomUUID().slice(0, 8);
    const empresa = await prisma.empresa.create({
      data: { nomeFantasia: 'Loja Integração A', slug: 'test-a-' + marcador },
    });
    const outra = await prisma.empresa.create({
      data: { nomeFantasia: 'Loja Integração B', slug: 'test-b-' + marcador },
    });
    empresaId = empresa.id;
    outroId = outra.id;
    const funcionario = await prisma.funcionario.create({
      data: {
        empresaId, nome: 'Operador Teste', cpf: '10000000000',
        cargo: 'OPERADOR_CAIXA',
      },
    });
    funcionarioId = funcionario.id;
    const caixa = await prisma.caixa.create({
      data: { empresaId, operadorId: funcionarioId, saldoInicial: 0 },
    });
    caixaId = caixa.id;
    const produto = await prisma.produto.create({
      data: {
        empresaId, nome: 'Produto Concorrente', estoqueAtual: 1,
        precoVendaVarejo: 10,
      },
    });
    produtoId = produto.id;
    const estrangeiro = await prisma.produto.create({
      data: {
        empresaId: outroId, nome: 'Produto de Outra Empresa',
        estoqueAtual: 10, precoVendaVarejo: 10,
      },
    });
    produtoOutraEmpresa = estrangeiro.id;
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function venda(id: number): CreateVendaDto {
    return {
      caixaId, funcionarioId,
      itens: [{ produtoId: id, quantidade: 1, precoUnitario: 10 }],
      pagamentos: [{ formaPagamento: FormaPagamento.DINHEIRO, valor: 10 }],
    };
  }

  it('não permite vender produto de outro tenant', async () => {
    await expect(vendas.create(empresaId, venda(produtoOutraEmpresa)))
      .rejects.toThrow();
    expect((await prisma.produto.findUnique({ where: { id: produtoOutraEmpresa } }))?.estoqueAtual)
      .toBe(10);
  });

  it('não vende mais unidades que o estoque em tentativas simultâneas', async () => {
    const resultados = await Promise.allSettled([
      vendas.create(empresaId, venda(produtoId)),
      vendas.create(empresaId, venda(produtoId)),
    ]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter(r => r.status === 'rejected')).toHaveLength(1);
    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    expect(produto?.estoqueAtual).toBe(0);
  });

  it('fecha o caixa contabilizando apenas dinheiro recebido', async () => {
    const fechamento = await caixaService.fecharCaixa(empresaId, caixaId, {
      saldoFinalFisico: 10,
    });
    expect(Number(fechamento.saldoFinalSistema)).toBe(10);
    expect(Number(fechamento.quebraDeCaixa)).toBe(0);
  });

  it('rejeita venda quando o caixa está fechado', async () => {
    await expect(vendas.create(empresaId, venda(produtoId))).rejects.toThrow();
  });
});
