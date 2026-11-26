import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AbrirCaixaDto } from './dto/abrir-caixa.dto';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';
import { MovimentacaoCaixaDto } from './dto/movimentacao-caixa.dto';
import { StatusCaixa, TipoMovimentacaoCaixa, FormaPagamento, StatusVenda } from '@prisma/client';

@Injectable()
export class CaixaService {
  constructor(private readonly prisma: PrismaService) {}

  async abrirCaixa(empresaId: number, abrirCaixaDto: AbrirCaixaDto) {
    if(!Number.isFinite(abrirCaixaDto.saldoInicial)||abrirCaixaDto.saldoInicial<0)throw new BadRequestException('Saldo inicial inválido.');
    return this.prisma.$transaction(async tx=>{
      // Lock the employee before checking for an existing register.
      const lock=await tx.funcionario.updateMany({where:{id:abrirCaixaDto.operadorId,empresaId,ativo:true},data:{ativo:true}});
      if(lock.count!==1)throw new NotFoundException('Operador não encontrado ou inativo nesta empresa.');
      const aberto=await tx.caixa.findFirst({where:{empresaId,operadorId:abrirCaixaDto.operadorId,status:StatusCaixa.ABERTO}});
      if(aberto)throw new BadRequestException('Já existe um caixa ABERTO para este operador nesta empresa.');
      return tx.caixa.create({data:{empresaId,operadorId:abrirCaixaDto.operadorId,saldoInicial:abrirCaixaDto.saldoInicial,status:StatusCaixa.ABERTO}});
    });
  }

  async adicionarMovimentacao(
    empresaId: number,
    caixaId: string,
    movimentacaoDto: MovimentacaoCaixaDto,
  ) {
    if(!Number.isFinite(movimentacaoDto.valor)||movimentacaoDto.valor<=0)throw new BadRequestException('Valor da movimentação deve ser positivo.');
    const caixa = await this.prisma.caixa.findFirst({
      where: { 
        empresaId,
        id: caixaId,
        operador: {
          empresaId,
        },
      },
      include: { operador: true },
    });

    if (!caixa) {
      throw new NotFoundException('Caixa não encontrado nesta empresa.');
    }

    if (caixa.status !== StatusCaixa.ABERTO) {
      throw new BadRequestException(
        'Não é possível realizar movimentações em um caixa FECHADO.',
      );
    }

    return this.prisma.$transaction(async tx => {
      const bloqueio = await tx.caixa.updateMany({
        where: { id: caixaId, empresaId, status: StatusCaixa.ABERTO },
        data: { status: StatusCaixa.ABERTO },
      });
      if (bloqueio.count !== 1) {
        throw new BadRequestException('Caixa fechado antes da movimentação.');
      }
      return tx.movimentacaoCaixa.create({
        data: {
          caixaId,
          tipo: movimentacaoDto.tipo,
          valor: movimentacaoDto.valor,
          categoria: movimentacaoDto.categoria,
          observacao: movimentacaoDto.observacao,
        },
      });
    });
  }

  async fecharCaixa(
    empresaId: number,
    caixaId: string,
    dto: FecharCaixaDto,
  ) {
    const saldoFisico = dto.saldoFinalFisico == null ? null : Number(dto.saldoFinalFisico);
    if (saldoFisico !== null && (!Number.isFinite(saldoFisico) || saldoFisico < 0)) {
      throw new BadRequestException('O saldo físico do caixa deve ser um valor não negativo.');
    }

    // O lock obtido por updateMany concilia com o lock utilizado na venda.
    return this.prisma.$transaction(async tx => {
      const bloqueio = await tx.caixa.updateMany({
        where: { id: caixaId, empresaId, status: StatusCaixa.ABERTO },
        data: { status: StatusCaixa.FECHADO },
      });
      if (bloqueio.count !== 1) {
        throw new BadRequestException('Caixa inexistente, de outra empresa ou já fechado.');
      }

      const caixa = await tx.caixa.findFirst({
        where: { id: caixaId, empresaId },
        include: { movimentacoes: true },
      });
      if (!caixa) throw new NotFoundException('Caixa não encontrado.');

      const pendentes=await tx.venda.count({where:{caixaId,empresaId,status:StatusVenda.CONCLUIDA,tipoEntrega:'DELIVERY',statusAcerto:'PENDENTE'}});
      if(pendentes>0)throw new BadRequestException('Conclua os acertos de delivery antes de fechar o caixa.');
      const totalSuprimentos = caixa.movimentacoes
        .filter(m => m.tipo === TipoMovimentacaoCaixa.SUPRIMENTO)
        .reduce((total, m) => total + Number(m.valor), 0);
      const totalSangrias = caixa.movimentacoes
        .filter(m => m.tipo === TipoMovimentacaoCaixa.SANGRIA)
        .reduce((total, m) => total + Number(m.valor), 0);

      const vendas = await tx.venda.findMany({
        where: {
          caixaId, empresaId, status: StatusVenda.CONCLUIDA,
          OR: [
            { tipoEntrega: 'RETIRADA_BALCAO' },
            { statusAcerto: 'CONCLUIDO' },
          ],
        },
        include: { pagamentos: true },
      });
      const dinheiroVendas = vendas.reduce(
        (total, venda) => total + venda.pagamentos
          .filter(p => p.formaPagamento === FormaPagamento.DINHEIRO)
          .reduce((sum, p) => sum + Number(p.valor) - Number(p.troco), 0),
        0,
      );

      const saldoFinalSistema =
        Math.round((Number(caixa.saldoInicial) + totalSuprimentos - totalSangrias + dinheiroVendas)*100)/100;
      return tx.caixa.update({
        where: { id: caixaId },
        data: {
          saldoFinalSistema,
          saldoFinalFisico: saldoFisico,
          quebraDeCaixa: saldoFisico === null ? null : Math.round((saldoFisico - saldoFinalSistema)*100)/100,
          status: StatusCaixa.FECHADO,
          fechadoEm: new Date(),
        },
      });
    });
  }

  async findCaixaAbertoPorOperador(empresaId: number, operadorId: string) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        operadorId,
        status: StatusCaixa.ABERTO,
        operador: {
          empresaId,
        },
      },
      include: {
        operador: true,
        movimentacoes: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    // No open register is an ordinary state.
    return caixa;
  }

  async findAll(empresaId: number) {
    const caixas = await this.prisma.caixa.findMany({
      where: {
        operador: {
          empresaId,
        },
      },
      include: {
        operador: true,
        movimentacoes: true,
      },
      orderBy: {
        abertoEm: 'desc',
      },
    });
    const totais = await this.prisma.venda.groupBy({
      by: ['caixaId'],
      where: { empresaId, status: StatusVenda.CONCLUIDA, caixaId: { in: caixas.map(c => c.id) } },
      _sum: { valorTotal: true }, _count: { id: true },
    });
    const porCaixa = new Map(totais.map(v => [v.caixaId, v]));
    return caixas.map(c => ({ ...c, totalVendas: Number(porCaixa.get(c.id)?._sum.valorTotal || 0),
      quantidadeVendas: porCaixa.get(c.id)?._count.id || 0 }));
  }

  async findOne(empresaId: number, id: string) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { 
        id,
        operador: {
          empresaId,
        },
      },
      include: {
        operador: true,
        movimentacoes: true,
        vendas: true,
      },
    });

    if (!caixa) {
      throw new NotFoundException(`Caixa com o ID ${id} não foi encontrado nesta empresa.`);
    }

    return caixa;
  }

  async obterExtratoMovimentacoes(empresaId: number, caixaId: string) {
    const caixa = await this.findOne(empresaId, caixaId);

    const totalSuprimentos = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SUPRIMENTO)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const totalSangrias = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SANGRIA)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    // Sales totals include all concluded sales, while drawer cash excludes unsettled deliveries.
    const vendas = await this.prisma.venda.findMany({
      where: { caixaId, empresaId, status: StatusVenda.CONCLUIDA },
      include: { pagamentos: true },
    });
    const pagamentos = Object.fromEntries(Object.values(FormaPagamento).map(f => [f, 0])) as Record<FormaPagamento, number>;
    let dinheiroVendas = 0;
    let entregasPendentes = 0;
    for (const venda of vendas) {
      const acertada = venda.tipoEntrega === 'RETIRADA_BALCAO' || venda.statusAcerto === 'CONCLUIDO';
      if (!acertada) entregasPendentes += Number(venda.valorTotal);
      for (const p of venda.pagamentos) {
        const liquido = Number(p.valor) - Number(p.troco);
        pagamentos[p.formaPagamento] += liquido;
        if (acertada && p.formaPagamento === FormaPagamento.DINHEIRO) dinheiroVendas += liquido;
      }
    }
    const totalVendas = vendas.reduce((total,v) => total + Number(v.valorTotal), 0);

    return {
      caixaId: caixa.id,
      status: caixa.status,
      saldoInicial: caixa.saldoInicial,
      totalSuprimentos,
      totalSangrias,
      totalDinheiroVendas: dinheiroVendas,
      totalVendas, quantidadeVendas: vendas.length, pagamentos, entregasPendentes,
      saldoFinalFisico: caixa.saldoFinalFisico, quebraDeCaixa: caixa.quebraDeCaixa,
      saldoParcialSistema: caixa.status===StatusCaixa.FECHADO && caixa.saldoFinalSistema!=null ? Number(caixa.saldoFinalSistema) : Math.round((Number(caixa.saldoInicial) + totalSuprimentos - totalSangrias + dinheiroVendas)*100)/100,
      movimentacoes: caixa.movimentacoes,
    };
  }
}