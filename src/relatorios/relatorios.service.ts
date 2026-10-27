import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusCaixa, StatusVenda } from '@prisma/client';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(empresaId: number) {
    try {
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);

      const inicioMes = new Date(
        hojeInicio.getFullYear(),
        hojeInicio.getMonth(),
        1,
      );

      // 1. Total faturado hoje em vendas concluídas para a empresa logada
      const vendasHoje = await this.prisma.venda.aggregate({
        where: {
          empresaId,
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: hojeInicio },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 2. Total faturado no mês corrente para a empresa logada
      const vendasMes = await this.prisma.venda.aggregate({
        where: {
          empresaId,
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: inicioMes },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 3. Total pendente em Fiados a receber da empresa logada
      const fiadosPendentes = await this.prisma.cliente.aggregate({
        where: {
          empresaId,
        },
        _sum: { saldoDevedor: true },
        _count: { id: true },
      });

      // 4. Top 5 produtos mais vendidos nas vendas concluídas da empresa
      const topProdutos = await this.prisma.itemVenda.groupBy({
        by: ['produtoId'],
        where: {
          venda: {
            empresaId,
            status: StatusVenda.CONCLUIDA,
          },
        },
        _sum: { quantidade: true, precoTotal: true },
        orderBy: {
          _sum: { quantidade: 'desc' },
        },
        take: 5,
      });

      const topProdutosDetalhados = await Promise.all(
        topProdutos.map(async (item) => {
          const produto = await this.prisma.produto.findFirst({
            where: { id: item.produtoId, empresaId },
            select: {
              id: true,
              nome: true,
              precoVendaVarejo: true,
              precoVendaAtacado: true,
              estoqueAtual: true,
            },
          });

          return {
            produto,
            quantidadeVendida: item._sum.quantidade || 0,
            totalArrecadado: Number(item._sum.precoTotal || 0),
          };
        }),
      );

      // 5. Status dos Caixas Abertos da empresa logada
      const caixasAbertos = await this.prisma.caixa.findMany({
        where: {
          empresaId,
          status: StatusCaixa.ABERTO,
        },
        include: {
          operador: { select: { id: true, nome: true } },
        },
      });

      return {
        faturamentoHoje: Number(vendasHoje._sum.valorTotal || 0),
        totalVendasHoje: vendasHoje._count.id,
        faturamentoMes: Number(vendasMes._sum.valorTotal || 0),
        totalVendasMes: vendasMes._count.id,
        totalFiadoAReceber: Number(fiadosPendentes._sum.saldoDevedor || 0),
        totalClientesDevedores: fiadosPendentes._count.id,
        topProdutosMaisVendidos: topProdutosDetalhados,
        caixasAtivos: caixasAbertos,
      };
    } catch (error: any) {
      console.error('Erro ao gerar Dashboard:', error);
      throw new InternalServerErrorException(
        `Erro ao consultar dados do Dashboard: ${error?.message || error}`,
      );
    }
  }
}