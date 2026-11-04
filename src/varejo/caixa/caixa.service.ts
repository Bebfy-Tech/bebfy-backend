import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AbrirCaixaDto } from './dto/abrir-caixa.dto';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';
import { MovimentacaoCaixaDto } from './dto/movimentacao-caixa.dto';
import { StatusCaixa, TipoMovimentacaoCaixa } from '@prisma/client';

@Injectable()
export class CaixaService {
  constructor(private readonly prisma: PrismaService) {}

  async abrirCaixa(abrirCaixaDto: AbrirCaixaDto, empresaId: number) {
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
        'Já existe um caixa ABERTO para este operador.',
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
    caixaId: string,
    movimentacaoDto: MovimentacaoCaixaDto,
    empresaId: number,
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

    return this.prisma.movimentacaoCaixa.create({
      data: {
        caixaId,
        tipo: movimentacaoDto.tipo,
        valor: movimentacaoDto.valor,
        categoria: movimentacaoDto.categoria,
        observacao: movimentacaoDto.observacao,
      },
    });
  }

  async fecharCaixa(
    caixaId: string,
    fecharCaixaDto: FecharCaixaDto,
    empresaId: number,
  ) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { 
        id: caixaId,
        operador: {
          empresaId,
        },
      },
      include: {
        operador: true,
        movimentacoes: true,
      },
    });

    if (!caixa) {
      throw new NotFoundException('Caixa não encontrado nesta empresa.');
    }

    if (caixa.status === StatusCaixa.FECHADO) {
      throw new BadRequestException('Este caixa já se encontra FECHADO.');
    }

    const totalSuprimentos = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SUPRIMENTO)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const totalSangrias = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SANGRIA)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const saldoInicial = Number(caixa.saldoInicial);
    const saldoFinalSistema = saldoInicial + totalSuprimentos - totalSangrias;

    const saldoFisico = Number(fecharCaixaDto.saldoFinalFisico);
    const quebraDeCaixa = saldoFisico - saldoFinalSistema;

    return this.prisma.caixa.update({
      where: { id: caixaId },
      data: {
        saldoFinalSistema,
        saldoFinalFisico: saldoFisico,
        quebraDeCaixa,
        status: StatusCaixa.FECHADO,
        fechadoEm: new Date(),
      },
    });
  }

  async findCaixaAbertoPorOperador(operadorId: string, empresaId: number) {
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

  async findOne(id: string, empresaId: number) {
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

  // Novo método de Extrato de Movimentações (Auditoria do Caixa)
  async obterExtratoMovimentacoes(caixaId: string, empresaId: number) {
    const caixa = await this.findOne(caixaId, empresaId);

    const totalSuprimentos = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SUPRIMENTO)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const totalSangrias = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SANGRIA)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    return {
      caixaId: caixa.id,
      status: caixa.status,
      saldoInicial: caixa.saldoInicial,
      totalSuprimentos,
      totalSangrias,
      saldoParcialSistema: Number(caixa.saldoInicial) + totalSuprimentos - totalSangrias,
      movimentacoes: caixa.movimentacoes,
    };
  }
}