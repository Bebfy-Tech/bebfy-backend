import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CriarMovimentacaoCascoDto } from './dto/criar-movimentacao-casco.dto';

@Injectable()
export class VasilhamesService {
  constructor(private readonly prisma: PrismaService) {}

  async registrarMovimentacao(dto: CriarMovimentacaoCascoDto, empresaId: number) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, empresaId },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado ou sem acesso a esta empresa.');
    }

    const produto = await this.prisma.produto.findFirst({
      where: { id: dto.produtoId, empresaId, ativo: true },
    });

    if (!produto) {
      throw new NotFoundException('Produto ou vasilhame não encontrado.');
    }

    if (!produto.retornavel) {
      throw new BadRequestException('O produto informado não é retornável.');
    }

    const ehEmprestimo = dto.tipo === 'EMPRESTIMO_SAIDA';
    const variacao = ehEmprestimo ? dto.quantidade : -dto.quantidade;

    return this.prisma.$transaction(async (tx) => {
      const atualizacao = await tx.cliente.updateMany({
        where: {
          id: cliente.id,
          empresaId,
          ativo: true,
          ...(ehEmprestimo ? {} : { cascosEmPosse: { gte: dto.quantidade } }),
        },
        data: { cascosEmPosse: { increment: variacao } },
      });
      if (atualizacao.count !== 1) {
        throw new BadRequestException('Saldo insuficiente de vasilhames ou cliente indisponível.');
      }

      const movimentacao = await tx.movimentacaoCasco.create({
        data: {
          empresaId,
          clienteId: dto.clienteId,
          produtoId: dto.produtoId,
          quantidade: variacao,
          observacao: dto.observacao ? `${dto.tipo}: ${dto.observacao}` : dto.tipo,
        },
        include: {
          cliente: { select: { id: true, nome: true, cascosEmPosse: true } },
          produto: { select: { id: true, nome: true } },
        },
      });

      return {
        mensagem: 'Movimentação de vasilhame registada com sucesso.',
        movimentacao,
      };
    });
  }

  async listarExtratoCliente(clienteId: string, empresaId: number) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
      select: { id: true, nome: true, cascosEmPosse: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    const historico = await this.prisma.movimentacaoCasco.findMany({
      where: { clienteId, empresaId },
      include: {
        produto: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    return {
      cliente,
      historico,
    };
  }
}