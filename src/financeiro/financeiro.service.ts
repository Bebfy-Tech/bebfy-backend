import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CriarContaDto } from './dto/criar-conta.dto';
import { StatusConta } from '@prisma/client';

type TipoConta = 'pagar' | 'receber';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(empresaId: number, tipo: TipoConta, dto: CriarContaDto) {
    const dados = {
      empresaId,
      descricao: dto.descricao,
      valor: dto.valor,
      dataVencimento: new Date(dto.dataVencimento),
    };
    if (tipo === 'pagar') {
      return this.prisma.contaPagar.create({
        data: { ...dados, categoria: dto.categoria || 'OUTROS' },
      });
    }
    return this.prisma.contaReceber.create({ data: dados });
  }

  async listar(empresaId: number, tipo: TipoConta, status?: StatusConta) {
    const where = { empresaId, ...(status ? { status } : {}) };
    if (tipo === 'pagar') {
      return this.prisma.contaPagar.findMany({
        where, orderBy: { dataVencimento: 'asc' },
      });
    }
    return this.prisma.contaReceber.findMany({
      where, orderBy: { dataVencimento: 'asc' },
    });
  }

  async alterarStatus(empresaId: number, tipo: TipoConta, id: string, status: 'PAGO' | 'CANCELADO') {
    if (tipo === 'pagar') {
      const result = await this.prisma.contaPagar.updateMany({
        where: { id, empresaId, status: StatusConta.PENDENTE },
        data: { status, dataPagamento: status === 'PAGO' ? new Date() : null },
      });
      if (!result.count) throw new NotFoundException('Conta inexistente ou não pendente nesta empresa.');
      return this.prisma.contaPagar.findFirst({ where: { id, empresaId } });
    }
    const result = await this.prisma.contaReceber.updateMany({
      where: { id, empresaId, status: StatusConta.PENDENTE },
      data: { status, dataRecebimento: status === 'PAGO' ? new Date() : null },
    });
    if (!result.count) throw new NotFoundException('Conta inexistente ou não pendente nesta empresa.');
    return this.prisma.contaReceber.findFirst({ where: { id, empresaId } });
  }

  async resumo(empresaId: number) {
    const [pagar, receber] = await Promise.all([
      this.prisma.contaPagar.groupBy({
        by: ['status'], where: { empresaId },
        _sum: { valor: true }, _count: { _all: true },
      }),
      this.prisma.contaReceber.groupBy({
        by: ['status'], where: { empresaId },
        _sum: { valor: true }, _count: { _all: true },
      }),
    ]);
    const converter = (linhas: typeof pagar) =>
      linhas.map(l => ({ status: l.status, quantidade: l._count._all, valor: Number(l._sum.valor || 0) }));
    const saldoPrevisto = receber
      .filter(l => l.status === 'PENDENTE')
      .reduce((v, l) => v + Number(l._sum.valor || 0), 0)
      - pagar.filter(l => l.status === 'PENDENTE')
        .reduce((v, l) => v + Number(l._sum.valor || 0), 0);
    return { contasPagar: converter(pagar), contasReceber: converter(receber), saldoPrevisto };
  }
}
