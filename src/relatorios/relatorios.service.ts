import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusCaixa, StatusVenda } from '@prisma/client';
import { consultarModulos } from '../common/modulos/plano-modulos';

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

      // Calculate bounded daily aggregates once for the union of the month and last 7 days.
      const inicioSerie = inicioMes < inicioSemana ? inicioMes : inicioSemana;
      const datas: Date[] = [];
      for (let d = new Date(inicioSerie); d < amanhaInicio; d.setDate(d.getDate() + 1)) datas.push(new Date(d));
      // Limit concurrent database requests, even on the last day of a month.
      const serie: Array<{ data: string; faturamento: number; quantidade: number }> = [];
      for (let i = 0; i < datas.length; i += 7) {
        serie.push(...await Promise.all(datas.slice(i,i+7).map(async inicio => {
          const fim = new Date(inicio); fim.setDate(fim.getDate() + 1);
          const vendas = await this.prisma.venda.aggregate({
            where: { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicio, lt: fim } },
            _sum: { valorTotal: true }, _count: { id: true },
          });
          return { data: diaLocal(inicio), faturamento: Number(vendas._sum.valorTotal || 0), quantidade: vendas._count.id };
        })));
      }
      // Two-hour intervals for today's chart. Do not expose individual transactions.
      const vendasHorasHoje: Array<{ data: string; faturamento: number; quantidade: number }> = [];
      for (let batch = 0; batch < 12; batch += 4) {
        vendasHorasHoje.push(...await Promise.all(Array.from({length:4},async (_, offset)=>{
          const hora=(batch+offset)*2;
          const inicio=new Date(hojeInicio); inicio.setHours(hora);
          const fim=new Date(hojeInicio); fim.setHours(hora+2);
          const v=await this.prisma.venda.aggregate({
            where:{empresaId,status:StatusVenda.CONCLUIDA,criadoEm:{gte:inicio,lt:fim}},
            _sum:{valorTotal:true},_count:{id:true},
          });
          return {data:String(hora).padStart(2,'0')+'h',faturamento:Number(v._sum.valorTotal||0),quantidade:v._count.id};
        })));
      }
      const vendasUltimos7Dias = serie.filter(d => d.data >= diaLocal(inicioSemana));
      const vendasDiasMes = serie.filter(d => d.data >= diaLocal(inicioMes));

      const pagamentosPeriodo = async (inicio: Date, fim: Date) => {
        const pagamentos = await this.prisma.pagamentoVenda.groupBy({
          by: ['formaPagamento'],
          where: { venda: { empresaId, status: StatusVenda.CONCLUIDA, criadoEm: { gte: inicio, lt: fim } } },
          _sum: { valor: true, troco: true },
        });
        return pagamentos.map(p => ({
          formaPagamento: p.formaPagamento,
          valor: Math.round((Number(p._sum.valor || 0) - Number(p._sum.troco || 0)) * 100) / 100,
        }));
      };
      const [pagamentosHoje, pagamentos7Dias, pagamentosMes, modulos, estoqueBaixo] = await Promise.all([
        pagamentosPeriodo(hojeInicio, amanhaInicio),
        pagamentosPeriodo(inicioSemana, amanhaInicio),
        pagamentosPeriodo(inicioMes, fimMes),
        consultarModulos(this.prisma, empresaId),
        this.prisma.produto.count({ where: { empresaId, ativo: true, estoqueAtual: { lte: this.prisma.produto.fields.estoqueMinimo } } }),
      ]);
      const limiteValidade = new Date(hojeInicio); limiteValidade.setDate(limiteValidade.getDate() + 31);
      const loteBase = { empresaId, quantidade: { gt: 0 }, produto: { empresaId, ativo: true } };
      const [lotesVencidos, lotesAVencer] = modulos.ESTOQUE_LOTES ? await Promise.all([
        this.prisma.loteProduto.count({ where: { ...loteBase, dataVencimento: { lt: hojeInicio } } }),
        this.prisma.loteProduto.count({ where: { ...loteBase, dataVencimento: { gte: hojeInicio, lt: limiteValidade } } }),
      ]) : [null,null];

      const [entregasPendentes, clientesComVasilhames] = await Promise.all([
        modulos.ENTREGAS_DELIVERY && modulos.CAIXA_PDV ? this.prisma.venda.count({where:{empresaId,status:StatusVenda.CONCLUIDA,tipoEntrega:'DELIVERY',statusAcerto:'PENDENTE'}}) : Promise.resolve(null),
        modulos.VASILHAMES_RETORNAVEIS ? this.prisma.cliente.count({where:{empresaId,ativo:true,cascosEmPosse:{gt:0}}}) : Promise.resolve(null),
      ]);
      return {
        vendasHorasHoje, vendasUltimos7Dias, vendasDiasMes,
        pagamentosHoje, pagamentos7Dias, pagamentosMes,
        alertas: { estoqueBaixo, lotesVencidos, lotesAVencer, entregasPendentes, clientesComVasilhames },
        faturamentoHoje: Number(vendasHoje._sum.valorTotal || 0),
        totalVendasHoje: vendasHoje._count.id,
        faturamentoMes: Number(vendasMes._sum.valorTotal || 0),
        totalVendasMes: vendasMes._count.id,
        totalFiadoAReceber: modulos.FIADOS ? Number(fiadosPendentes._sum.saldoDevedor || 0) : 0,
        totalClientesDevedores: modulos.FIADOS ? fiadosPendentes._count.id : 0,
        topProdutosMaisVendidos: topProdutosDetalhados,
        caixasAtivos: modulos.CAIXA_PDV ? caixasAbertos : [],
      };
    } catch (error: any) {
      console.error('Erro ao gerar Dashboard:', error);
      throw new InternalServerErrorException(
        `Erro ao consultar dados do Dashboard: ${error?.message || error}`,
      );
    }
  }
  // Operational dashboard contains no tenant-wide financial totals.
  async getOperacional(empresaId:number, funcionarioId:string) {
    const modulos=await consultarModulos(this.prisma,empresaId);
    const [estoqueBaixo,caixa] = await Promise.all([
      this.prisma.produto.count({where:{empresaId,ativo:true,estoqueAtual:{lte:this.prisma.produto.fields.estoqueMinimo}}}),
      modulos.CAIXA_PDV ? this.prisma.caixa.findFirst({where:{empresaId,operadorId:funcionarioId,status:StatusCaixa.ABERTO},select:{id:true,abertoEm:true}}) : Promise.resolve(null),
    ]);
    return {estoqueBaixo, caixaAberto: Boolean(caixa), caixaAbertoEm: caixa?.abertoEm??null};
  }
}
