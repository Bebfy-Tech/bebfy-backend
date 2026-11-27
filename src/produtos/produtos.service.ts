import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async listarGestao(empresaId: number) {
    return this.prisma.produto.findMany({
      where: { empresaId },
      include: { categoria: true, lotes: true, foto: { select: { produtoId: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async alterarSituacao(id: number, empresaId: number, ativo: boolean) {
    const resultado = await this.prisma.produto.updateMany({
      where: { id, empresaId }, data: { ativo },
    });
    if (resultado.count !== 1) throw new NotFoundException('Produto não encontrado nesta empresa.');
    return { ok: true, ativo };
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
      throw new NotFoundException(`Produto com o ID ${id} não foi encontrado nesta empresa.`);
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
      throw new NotFoundException('Produto não encontrado pelo código de barras nesta empresa.');
    }

    return produto;
  }

  async buscarInteligente(termo: string, empresaId: number) {
    if (!termo) {
      return this.findAll(empresaId);
    }

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
        OR: [
          { nome: { contains: termo, mode: 'insensitive' } },
          { marca: { contains: termo, mode: 'insensitive' } },
          { fabricante: { contains: termo, mode: 'insensitive' } },
          { grupo: { contains: termo, mode: 'insensitive' } },
          { subgrupo: { contains: termo, mode: 'insensitive' } },
        ],
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

  /** O guard define o tenant; todas as operações verificam o produto antes de acessar a foto. */
  async obterFoto(id: number, empresaId: number) {
    await this.findOne(id, empresaId);
    const foto = await this.prisma.produtoFoto.findFirst({
      where: { produtoId: id, produto: { empresaId, ativo: true } },
      select: { jpeg: true },
    });
    return { base64: foto ? Buffer.from(foto.jpeg).toString('base64') : null };
  }

  async salvarFoto(id: number, empresaId: number, base64: string) {
    // Apenas JPEG, sem SVG/HTML, URLs externas ou arquivos executáveis.
    const jpeg = Buffer.from(base64, 'base64');
    if (jpeg.length < 8 || jpeg.length > 65536 || jpeg.toString('base64') !== base64 ||
        jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff ||
        jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9) {
      throw new BadRequestException('Foto JPEG inválida ou maior que 64 KB.');
    }
    await this.findOne(id, empresaId);
    await this.prisma.produtoFoto.upsert({
      where: { produtoId: id },
      create: { produtoId: id, jpeg },
      update: { jpeg },
    });
    return { ok: true };
  }

  async excluirFoto(id: number, empresaId: number) {
    await this.findOne(id, empresaId);
    await this.prisma.produtoFoto.deleteMany({ where: { produtoId: id, produto: { empresaId, ativo: true } } });
    return { ok: true };
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