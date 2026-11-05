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

    let novoSaldoCascos = cliente.cascosEmPosse;

    if (dto.tipo === 'EMPRESTIMO_SAIDA') {
      novoSaldoCascos += dto.quantidade;
    } else if (dto.tipo === 'DEVOLUCAO_ENTRADA') {
      if (cliente.cascosEmPosse < dto.quantidade) {
        throw new BadRequestException(
          `O cliente possui apenas ${cliente.cascosEmPosse} vasilhame(s) em posse, não sendo possível devolver ${dto.quantidade}.`,
        );
      }
      novoSaldoCascos -= dto.quantidade;
    } else if (dto.tipo === 'QUEBRA_AVARIA') {
      if (cliente.cascosEmPosse < dto.quantidade) {
        throw new BadRequestException('Quantidade de quebra superior aos cascos em posse do cliente.');
      }
      novoSaldoCascos -= dto.quantidade;
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { cascosEmPosse: novoSaldoCascos },
      });

      const movimentacao = await tx.movimentacaoCasco.create({
        data: {
          empresaId,
          clienteId: dto.clienteId,
          produtoId: dto.produtoId,
          quantidade: dto.quantidade,
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