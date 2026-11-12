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
    const operador = await this.prisma.funcionario.findFirst({
      where: {
        id: abrirCaixaDto.operadorId,
        empresaId,
      },
    });

    if (!operador) {
      throw new NotFoundException('O operador informado não foi encontrado nesta empresa.');
    }

    const caixaAberto = await this.prisma.caixa.findFirst({
      where: {
        operadorId: abrirCaixaDto.operadorId,
        status: StatusCaixa.ABERTO,
        operador: {
          empresaId,
        },
      },
    });

    if (caixaAberto) {
      throw new BadRequestException(
        'Já existe um caixa ABERTO para este operador nesta empresa.',
      );
    }

    return this.prisma.caixa.create({
      data: {
        empresaId,
        operadorId: abrirCaixaDto.operadorId,
        saldoInicial: abrirCaixaDto.saldoInicial,
        status: StatusCaixa.ABERTO,
      } as any,
    });
  }

  async adicionarMovimentacao(
    empresaId: number,
    caixaId: string,
    movimentacaoDto: MovimentacaoCaixaDto,
  ) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { 
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
    const saldoFisico = Number(dto.saldoFinalFisico);
    if (!Number.isFinite(saldoFisico) || saldoFisico < 0) {
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
        Number(caixa.saldoInicial) + totalSuprimentos - totalSangrias + dinheiroVendas;
      return tx.caixa.update({
        where: { id: caixaId },
        data: {
          saldoFinalSistema,
          saldoFinalFisico: saldoFisico,
          quebraDeCaixa: saldoFisico - saldoFinalSistema,
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

    if (!caixa) {
      throw new NotFoundException(
        'Nenhum caixa ABERTO localizado para este operador nesta empresa.',
      );
    }

    return caixa;
  }

  async findAll(empresaId: number) {
    return this.prisma.caixa.findMany({
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

    const vendas = await this.prisma.venda.findMany({
      where: {
        caixaId, empresaId, status: StatusVenda.CONCLUIDA,
        OR: [{ tipoEntrega: 'RETIRADA_BALCAO' }, { statusAcerto: 'CONCLUIDO' }],
      },
      include: { pagamentos: true },
    });
    const dinheiroVendas = vendas.reduce(
      (total, venda) => total + venda.pagamentos
        .filter(p => p.formaPagamento === FormaPagamento.DINHEIRO)
        .reduce((sum, p) => sum + Number(p.valor) - Number(p.troco), 0),
      0,
    );

    return {
      caixaId: caixa.id,
      status: caixa.status,
      saldoInicial: caixa.saldoInicial,
      totalSuprimentos,
      totalSangrias,
      totalDinheiroVendas: dinheiroVendas,
      saldoParcialSistema: Number(caixa.saldoInicial) + totalSuprimentos - totalSangrias + dinheiroVendas,
      movimentacoes: caixa.movimentacoes,
    };
  }
}