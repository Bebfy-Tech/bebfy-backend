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

      const amanhaInicio = new Date(hojeInicio);
      amanhaInicio.setDate(amanhaInicio.getDate() + 1);
      const fimMes = new Date(hojeInicio.getFullYear(), hojeInicio.getMonth() + 1, 1);
      const inicioSemana = new Date(hojeInicio);
      inicioSemana.setDate(inicioSemana.getDate() - 6);
      const diaLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // 1. Total faturado hoje em vendas concluídas para a empresa logada
      const vendasHoje = await this.prisma.venda.aggregate({
        where: {
          empresaId,
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: hojeInicio, lt: amanhaInicio },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 2. Total faturado no mês corrente para a empresa logada
      const vendasMes = await this.prisma.venda.aggregate({
        where: {
          empresaId,
          status: StatusVenda.CONCLUIDA,
          criadoEm: { gte: inicioMes, lt: fimMes },
        },
        _sum: { valorTotal: true },
        _count: { id: true },
      });

      // 3. Total pendente em Fiados a receber da empresa logada
      const fiadosPendentes = await this.prisma.cliente.aggregate({
        where: {
          empresaId,
          saldoDevedor: { gt: 0 },
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

      // Série com sete dias corridos, inclusive dias sem vendas. Agrupa no banco
      // por intervalo para não transportar todas as vendas para o frontend.
      const vendasUltimos7Dias = await Promise.all(
        Array.from({ length: 7 }, async (_, index) => {
          const inicio = new Date(inicioSemana);
          inicio.setDate(inicio.getDate() + index);
          const fim = new Date(inicio);
          fim.setDate(fim.getDate() + 1);
          const vendas = await this.prisma.venda.aggregate({
            where: { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicio, lt: fim } },
            _sum: { valorTotal: true },
            _count: { id: true },
          });
          return { data: diaLocal(inicio), faturamento: Number(vendas._sum.valorTotal || 0), quantidade: vendas._count.id };
        }),
      );

      // Valores líquidos de troco, somente vendas concluídas no mês corrente.
      // Fiado integra o valor das vendas, não representa dinheiro recebido.
      const pagamentos = await this.prisma.pagamentoVenda.groupBy({
        by: ['formaPagamento'],
        where: { venda: { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicioMes, lt: fimMes } } },
        _sum: { valor: true, troco: true },
      });
      const pagamentosMes = pagamentos.map(p => ({
        formaPagamento: p.formaPagamento,
        valor: Math.round((Number(p._sum.valor || 0) - Number(p._sum.troco || 0)) * 100) / 100,
      }));

      return {
        vendasUltimos7Dias,
        pagamentosMes,
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