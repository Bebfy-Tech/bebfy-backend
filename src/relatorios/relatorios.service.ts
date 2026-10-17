import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusCaixa, StatusVenda } from '@prisma/client';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    try {
      const hojeInicio = new Date();
      hojeInicio.setHours(0, 0, 0, 0);

      const inicioMes = new Date(
        hojeInicio.getFullYear(),
        hojeInicio.getMonth(),
        1,
      );

      // 1. Total faturado hoje em vendas concluídas
      const vendasHoje = await this.prisma.venda.aggregate({
        where: {
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: hojeInicio },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 2. Total faturado no mês corrente
      const vendasMes = await this.prisma.venda.aggregate({
        where: {
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: inicioMes },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 3. Total pendente em Fiados a receber
      const fiadosPendentes = await this.prisma.cliente.aggregate({
        _sum: { saldoDevedor: true },
        _count: { id: true },
      });

      // 4. Top 5 produtos mais vendidos
      const topProdutos = await this.prisma.itemVenda.groupBy({
        by: ['produtoId'],
        _sum: { quantidade: true, precoTotal: true },
        orderBy: {
          _sum: { quantidade: 'desc' },
        },
        take: 5,
      });

      const topProdutosDetalhados = await Promise.all(
        topProdutos.map(async (item) => {
          const produto = await this.prisma.produto.findUnique({
            where: { id: item.produtoId },
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

      // 5. Status dos Caixas Abertos
      const caixasAbertos = await this.prisma.caixa.findMany({
        where: { status: StatusCaixa.ABERTO },
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