import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLoteDto: CreateLoteDto, empresaId: number = 1) {
    // 1. Busca o produto pelo ID
    const produto = await this.prisma.produto.findUnique({
      where: { id: createLoteDto.produtoId },
    });

    if (!produto) {
      throw new NotFoundException('O produto informado para este lote não foi encontrado.');
    }

    // Validação de segurança por empresa
    const produtoEmpresaId = (produto as any)?.empresaId;
    if (produtoEmpresaId && produtoEmpresaId !== empresaId) {
      throw new NotFoundException('O produto informado não pertence a esta empresa.');
    }

    // 2. Cria o lote e atualiza o estoque do produto
    return this.prisma.$transaction(async (tx) => {
      const lote = await tx.loteProduto.create({
        data: {
          produtoId: createLoteDto.produtoId,
          quantidade: createLoteDto.quantidade,
          numeroLote: createLoteDto.numeroLote,
          dataVencimento: createLoteDto.dataVencimento
            ? new Date(createLoteDto.dataVencimento)
            : null,
        } as any,
      });

      await tx.produto.update({
        where: { id: createLoteDto.produtoId },
        data: {
          estoqueAtual: {
            increment: createLoteDto.quantidade,
          },
        },
      });

      return lote;
    });
  }

  async findAll(empresaId: number = 1) {
    const lotes = await this.prisma.loteProduto.findMany({
      include: {
        produto: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });

    // Filtra os lotes por empresa garantindo compatibilidade de tipos
    return lotes.filter((lote) => {
      const produtoEmpresaId = (lote.produto as any)?.empresaId;
      return !produtoEmpresaId || produtoEmpresaId === empresaId;
    });
  }

  async findOne(id: number, empresaId: number = 1) {
    const lote = await this.prisma.loteProduto.findUnique({
      where: { id },
      include: {
        produto: true,
      },
    });

    const produtoEmpresaId = (lote?.produto as any)?.empresaId;

    if (!lote || (produtoEmpresaId && produtoEmpresaId !== empresaId)) {
      throw new NotFoundException(`Lote com o ID ${id} não foi encontrado nesta empresa.`);
    }

    return lote;
  }

  async remove(id: number, empresaId: number = 1) {
    const lote = await this.findOne(id, empresaId);

    return this.prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id: lote.produtoId },
        data: {
          estoqueAtual: {
            decrement: lote.quantidade,
          },
        },
      });

      return tx.loteProduto.delete({
        where: { id },
      });
    });
  }
}