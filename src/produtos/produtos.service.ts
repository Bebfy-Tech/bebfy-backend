// Importamos os decoradores e exceções do NestJS
import { Injectable, NotFoundException } from '@nestjs/common';
// Importamos os DTOs de criação e atualização
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
// Importamos o PrismaService
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

// src/produtos/produtos.service.ts
async create(createProdutoDto: CreateProdutoDto, empresaId: number) {
  return this.prisma.produto.create({
    data: {
      ...createProdutoDto,
      empresaId, // Adicionado para atender o Multi-tenancy
    },
  });
}

  // Busca todos os produtos cadastrados
  async findAll() {
    return this.prisma.produto.findMany({
      include: {
        categoria: true,
        lotes: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  // Busca um produto pelo ID numérico sequencial (ex: 1, 2, 3)
  async findOne(id: number) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
      include: {
        categoria: true,
        lotes: true,
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto com o ID ${id} não foi encontrado.`);
    }

    return produto;
  }

  // Atualiza um produto pelo ID numérico
  async update(id: number, updateProdutoDto: UpdateProdutoDto) {
    await this.findOne(id);

    return this.prisma.produto.update({
      where: { id },
      data: updateProdutoDto,
    });
  }

  // Remove um produto pelo ID numérico
  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.produto.delete({
      where: { id },
    });
  }
}
