import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateLoteDto } from './dto/create-lote.dto';

@Injectable()
export class LotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createLoteDto: CreateLoteDto) {
    // 1. Busca o produto pelo ID garantindo pertencimento à empresa
    const produto = await this.prisma.produto.findFirst({
      where: { id: createLoteDto.produtoId, empresaId },
    });

    if (!produto) {
      throw new NotFoundException('O produto informado para este lote não foi encontrado nesta empresa.');
    }

    // 2. Cria o lote e atualiza o estoque do produto em transação atômica
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

  async findAll(empresaId: number) {
    return this.prisma.loteProduto.findMany({
      where: {
        produto: {
          empresaId,
        },
      },
      include: {
        produto: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async findOne(empresaId: number, id: number) {
    const lote = await this.prisma.loteProduto.findFirst({
      where: {
        id,
        produto: {
          empresaId,
        },
      },
      include: {
        produto: true,
      },
    });

    if (!lote) {
      throw new NotFoundException(`Lote com o ID ${id} não foi encontrado nesta empresa.`);
    }

    return lote;
  }

  async remove(empresaId: number, id: number) {
    const lote = await this.findOne(empresaId, id);

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