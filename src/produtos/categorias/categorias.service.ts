import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createCategoriaDto: CreateCategoriaDto) {
    return this.prisma.categoria.create({
      data: {
        ...createCategoriaDto,
        empresaId,
      },
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.categoria.findMany({
      where: { empresaId },
      include: {
        _count: {
          select: { produtos: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(empresaId: number, id: string) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { id, empresaId },
      include: { produtos: true },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoria não encontrada ou não pertence a esta empresa.`);
    }

    return categoria;
  }

  async update(empresaId: number, id: string, updateCategoriaDto: UpdateCategoriaDto) {
    await this.findOne(empresaId, id);

    return this.prisma.categoria.update({
      where: { id },
      data: updateCategoriaDto,
    });
  }

  async remove(empresaId: number, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.categoria.delete({
      where: { id },
    });
  }
}