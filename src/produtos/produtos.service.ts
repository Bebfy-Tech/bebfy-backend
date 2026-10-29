import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProdutoDto: CreateProdutoDto, empresaId: number) {
    return this.prisma.produto.create({
      data: {
        ...createProdutoDto,
        empresaId,
      },
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.produto.findMany({
      where: {
        empresaId,
        ativo: true,
      },
      include: {
        categoria: true,
        lotes: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async findOne(id: number, empresaId: number) {
    const produto = await this.prisma.produto.findFirst({
      where: { id, empresaId, ativo: true },
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

  async buscarPorCodigoBarras(codigo: string, empresaId: number) {
    const produto = await this.prisma.produto.findFirst({
      where: {
        codigoBarras: codigo,
        empresaId,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        codigoBarras: true,
        precoVendaVarejo: true,
        precoVendaAtacado: true,
        fardoQuantidade: true,
        retornavel: true,
        estoqueAtual: true,
      },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado pelo código de barras.');
    }

    return produto;
  }

  async buscarInteligente(termo: string, empresaId: number) {
    const produtoPorCodigo = await this.prisma.produto.findFirst({
      where: {
        codigoBarras: termo,
        empresaId,
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        codigoBarras: true,
        precoVendaVarejo: true,
        precoVendaAtacado: true,
        fardoQuantidade: true,
        retornavel: true,
        estoqueAtual: true,
      },
    });

    if (produtoPorCodigo) {
      return [produtoPorCodigo];
    }

    return this.prisma.produto.findMany({
      where: {
        nome: { contains: termo, mode: 'insensitive' },
        empresaId,
        ativo: true,
      },
      take: 15,
      select: {
        id: true,
        nome: true,
        codigoBarras: true,
        precoVendaVarejo: true,
        precoVendaAtacado: true,
        fardoQuantidade: true,
        retornavel: true,
        estoqueAtual: true,
      },
    });
  }

  async update(id: number, updateProdutoDto: UpdateProdutoDto, empresaId: number) {
    await this.findOne(id, empresaId);

    return this.prisma.produto.update({
      where: { id },
      data: updateProdutoDto,
    });
  }

  async remove(id: number, empresaId: number) {
    await this.findOne(id, empresaId);

    return this.prisma.produto.update({
      where: { id },
      data: { ativo: false },
    });
  }
}