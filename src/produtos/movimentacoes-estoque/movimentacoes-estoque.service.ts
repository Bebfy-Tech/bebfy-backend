import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateMovimentacaoEstoqueDto } from './dto/create-movimentacao-estoque.dto';

@Injectable()
export class MovimentacoesEstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  // Registra a movimentação e atualiza o saldo do produto atomicamente
  async create(empresaId: number, createDto: CreateMovimentacaoEstoqueDto) {
    // 1. Valida se o produto existe e pertence estritamente a esta empresa
    const produto = await this.prisma.produto.findFirst({
      where: { id: createDto.produtoId, empresaId },
    });

    if (!produto) {
      throw new NotFoundException(
        `Produto ID ${createDto.produtoId} não encontrado nesta empresa.`,
      );
    }

    // 2. Verifica dinamicamente se o tipo representa uma saída/perda/avaria no estoque
    const tipoStr = String(createDto.tipo);
    const ehSaida =
      tipoStr.includes('SAIDA') ||
      tipoStr.includes('PERDA') ||
      tipoStr.includes('AVARIA') ||
      tipoStr.includes('BAIXA');

    // 3. Valida se há estoque suficiente para registrar a baixa
    if (ehSaida && produto.estoqueAtual < createDto.quantidade) {
      throw new BadRequestException(
        `Estoque insuficiente para registrar a baixa de "${produto.nome}". Disponível: ${produto.estoqueAtual}, Solicitado: ${createDto.quantidade}.`,
      );
    }

    // 4. Executa a gravação e a atualização do estoque em uma transação atômica
    return this.prisma.$transaction(async (tx) => {
      const deltaEstoque = ehSaida
        ? -createDto.quantidade
        : createDto.quantidade;

      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          empresaId,
          produtoId: createDto.produtoId,
          tipo: createDto.tipo,
          quantidade: createDto.quantidade,
          motivo: createDto.observacao
            ? `${createDto.motivo || ''} - Obs: ${createDto.observacao}`.trim()
            : createDto.motivo,
        },
      });

      const atualizacao = await tx.produto.updateMany({
        where: {
          id: createDto.produtoId,
          empresaId,
          ...(ehSaida ? { estoqueAtual: { gte: createDto.quantidade } } : {}),
        },
        data: { estoqueAtual: { increment: deltaEstoque } },
      });
      if (atualizacao.count !== 1) {
        throw new BadRequestException('Saldo insuficiente ou produto indisponível durante a movimentação.');
      }

      return tx.movimentacaoEstoque.findUnique({
        where: { id: movimentacao.id },
        include: { produto: true },
      });
    });
  }

  // Lista o histórico de movimentações da empresa
  async findAll(empresaId: number) {
    return this.prisma.movimentacaoEstoque.findMany({
      where: {
        produto: {
          empresaId,
        },
      },
      include: { produto: true },
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Busca detalhes de uma movimentação pelo ID garantindo isolamento por empresa
  async findOne(empresaId: number, id: any) {
    const movimentacao = await this.prisma.movimentacaoEstoque.findFirst({
      where: {
        id,
        produto: {
          empresaId,
        },
      },
      include: { produto: true },
    });

    if (!movimentacao) {
      throw new NotFoundException(
        `Movimentação de estoque ID ${id} não encontrada nesta empresa.`,
      );
    }

    return movimentacao;
  }
}