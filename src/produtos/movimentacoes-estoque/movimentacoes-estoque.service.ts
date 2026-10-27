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
  async create(createDto: CreateMovimentacaoEstoqueDto, empresaId: number = 1) {
    // 1. Valida se o produto existe e pertence a esta empresa
    const produto = await this.prisma.produto.findUnique({
      where: { id: createDto.produtoId },
    });

    if (!produto) {
      throw new NotFoundException(
        `Produto ID ${createDto.produtoId} não encontrado.`,
      );
    }

    const produtoEmpresaId = (produto as any)?.empresaId;
    if (produtoEmpresaId && produtoEmpresaId !== empresaId) {
      throw new NotFoundException(
        `Produto ID ${createDto.produtoId} não pertence a esta empresa.`,
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
          produtoId: createDto.produtoId,
          tipo: createDto.tipo,
          quantidade: createDto.quantidade,
          motivo: createDto.observacao
            ? `${createDto.motivo || ''} - Obs: ${createDto.observacao}`.trim()
            : createDto.motivo,
        } as any,
      });

      await tx.produto.update({
        where: { id: createDto.produtoId },
        data: {
          estoqueAtual: {
            increment: deltaEstoque,
          },
        },
      });

      return tx.movimentacaoEstoque.findUnique({
        where: { id: movimentacao.id },
        include: { produto: true },
      });
    });
  }

  // Lista o histórico de movimentações da empresa
  async findAll(empresaId: number = 1) {
    const movimentacoes = await this.prisma.movimentacaoEstoque.findMany({
      include: { produto: true },
      orderBy: { criadoEm: 'desc' },
    });

    return movimentacoes.filter((mov) => {
      const pEmpresaId = (mov.produto as any)?.empresaId;
      return !pEmpresaId || pEmpresaId === empresaId;
    });
  }

  // Busca detalhes de uma movimentação pelo ID garantindo isolamento por empresa
  async findOne(id: any, empresaId: number = 1) {
    const movimentacao = await this.prisma.movimentacaoEstoque.findUnique({
      where: { id },
      include: { produto: true },
    });

    const produtoEmpresaId = (movimentacao?.produto as any)?.empresaId;

    if (!movimentacao || (produtoEmpresaId && produtoEmpresaId !== empresaId)) {
      throw new NotFoundException(
        `Movimentação de estoque ID ${id} não encontrada nesta empresa.`,
      );
    }

    return movimentacao;
  }
}