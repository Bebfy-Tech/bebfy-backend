import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoriaDto: CreateCategoriaDto, empresaId: number = 1) {
    return this.prisma.categoria.create({
      data: {
        ...createCategoriaDto,
        empresaId,
      },
    });
  }

  async findAll() {
    return this.prisma.categoria.findMany({
      include: {
        _count: {
          select: { produtos: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id },
      include: { produtos: true },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoria com ID ${id} não encontrada.`);
    }

    return categoria;
  }

  async update(id: string, updateCategoriaDto: UpdateCategoriaDto) {
    await this.findOne(id);

    return this.prisma.categoria.update({
      where: { id },
      data: updateCategoriaDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.categoria.delete({
      where: { id },
    });
  }
}
