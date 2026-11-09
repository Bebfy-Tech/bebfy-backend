import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { PagarFiadoDto } from './dto/pagar-fiado.dto';
import { TipoTransacaoFiado, TipoMovimentacaoCaixa } from '@prisma/client';

@Injectable()
export class FiadosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createFiadoDto: CreateFiadoDto) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: createFiadoDto.clienteId, empresaId, ativo: true },
    });

    if (!cliente) {
      throw new NotFoundException('O cliente informado não foi encontrado nesta empresa.');
    }

    const valorNum = Number(createFiadoDto.valor);
    const saldoAtual = Number(cliente.saldoDevedor);
    const limiteCredito = Number(cliente.limiteCredito);

    if (createFiadoDto.tipo === TipoTransacaoFiado.DEBITO) {
      const saldoProjetado = saldoAtual + valorNum;
      if (limiteCredito > 0 && saldoProjetado > limiteCredito) {
        throw new BadRequestException(
          `Operação bloqueada: O novo saldo (R$ ${saldoProjetado.toFixed(
            2,
          )}) ultrapassaria o limite de crédito permitido (R$ ${limiteCredito.toFixed(
            2,
          )}).`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (createFiadoDto.vendaId) {
        const venda = await tx.venda.findFirst({ where: { id: createFiadoDto.vendaId, empresaId, clienteId: createFiadoDto.clienteId } });
        if (!venda) throw new BadRequestException('Venda não pertence ao cliente e empresa informados.');
      }
      let novoSaldo = saldoAtual;
      if (createFiadoDto.tipo === TipoTransacaoFiado.CREDITO) {
        novoSaldo -= valorNum;
      } else {
        novoSaldo += valorNum;
      }

      if (novoSaldo < 0) {
        throw new BadRequestException('Crédito superior ao saldo devedor.');
      }
      const alteracao = await tx.cliente.updateMany({
        where: {
          id: createFiadoDto.clienteId,
          empresaId,
          ativo: true,
          saldoDevedor: { equals: cliente.saldoDevedor },
        },
        data: { saldoDevedor: novoSaldo },
      });
      if (alteracao.count !== 1) {
        throw new ConflictException('O saldo do cliente mudou. Repita a operação para evitar duplicidade.');
      }

      return tx.historicoFiado.create({
        data: {
          clienteId: createFiadoDto.clienteId,
          vendaId: createFiadoDto.vendaId,
          tipo: createFiadoDto.tipo,
          valor: createFiadoDto.valor,
          descricao: createFiadoDto.descricao,
          saldoApos: novoSaldo,
        },
      });
    });
  }

  async registrarPagamento(empresaId: number, clienteId: string, dto: PagarFiadoDto) {
    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: { id: clienteId, empresaId, ativo: true },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente não encontrado nesta empresa.');
      }

      const valorNum = Number(dto.valor);
      if (valorNum > Number(cliente.saldoDevedor)) {
        throw new BadRequestException('Pagamento superior ao saldo devedor do cliente.');
      }
      const abatimento = await tx.cliente.updateMany({
        where: { id: clienteId, empresaId, saldoDevedor: { gte: valorNum } },
        data: { saldoDevedor: { decrement: valorNum } },
      });
      if (abatimento.count !== 1) {
        throw new BadRequestException('Saldo insuficiente ou alterado durante o pagamento.');
      }

      const clienteAtualizado = await tx.cliente.findUniqueOrThrow({
        where: { id: clienteId }, select: { saldoDevedor: true },
      });
      const novoSaldo = Number(clienteAtualizado.saldoDevedor);

      const historico = await tx.historicoFiado.create({
        data: {
          clienteId,
          tipo: TipoTransacaoFiado.CREDITO,
          valor: dto.valor,
          descricao: `Baixa de fiado no balcão - Forma: ${dto.formaPagamento}`,
          saldoApos: novoSaldo,
        },
      });

      if (dto.caixaId) {
        const caixa = await tx.caixa.findFirst({
          where: { id: dto.caixaId, empresaId, status: 'ABERTO' },
        });

        if (!caixa) {
          throw new BadRequestException('Caixa informado não está aberto nesta empresa.');
        }
        if (dto.formaPagamento === 'DINHEIRO') {
          await tx.movimentacaoCaixa.create({
            data: {
              caixaId: dto.caixaId,
              tipo: TipoMovimentacaoCaixa.SUPRIMENTO,
              valor: dto.valor,
              categoria: 'RECEBIMENTO_FIADO',
              observacao: `Recebimento de fiado do cliente ${cliente.nome} (${dto.formaPagamento})`,
            },
          });
        }
      }

      return {
        sucesso: true,
        saldoDevedorAtual: novoSaldo,
        historico,
      };
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.historicoFiado.findMany({
      where: {
        cliente: {
          empresaId,
        },
      },
      include: {
        cliente: true,
        venda: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async findByCliente(empresaId: number, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId, ativo: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado nesta empresa.');
    }

    return this.prisma.historicoFiado.findMany({
      where: { clienteId },
      include: {
        venda: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }
}