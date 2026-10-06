import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProdutosService {
  // Injeta o serviço do Prisma para fazer consultas à base de dados
  constructor(private readonly prisma: PrismaService) {}

  // Cria um novo produto no PostgreSQL
  async create(createProdutoDto: CreateProdutoDto) {
    return this.prisma.produto.create({
      data: createProdutoDto,
    });
  }

  // Procura e retorna todos os produtos (do mais recente para o mais antigo)
  async findAll() {
    return this.prisma.produto.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Procura um único produto pelo ID (UUID)
  async findOne(id: string) {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
    });

    // Se o produto não for encontrado, lança um erro 404
    if (!produto) {
      throw new NotFoundException(`Produto com o ID ${id} não foi encontrado.`);
    }

    return produto;
  }

  // Atualiza as informações de um produto existente
  async update(id: string, updateProdutoDto: UpdateProdutoDto) {
    // Garante que o produto existe antes de tentar atualizar
    await this.findOne(id);

    return this.prisma.produto.update({
      where: { id },
      data: updateProdutoDto,
    });
  }

  // Elimina um produto da base de dados
  async remove(id: string) {
    // Garante que o produto existe antes de eliminar
    await this.findOne(id);

    return this.prisma.produto.delete({
      where: { id },
    });
  }
}