import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createFornecedorDto: CreateFornecedorDto) {
    const fornecedorExiste = await this.prisma.fornecedor.findFirst({
      where: {
        empresaId,
        cnpj: createFornecedorDto.cnpj,
      },
    });

    if (fornecedorExiste) {
      throw new ConflictException('Já existe um fornecedor com este CNPJ nesta empresa.');
    }

    return this.prisma.fornecedor.create({
      data: {
        ...createFornecedorDto,
        empresaId,
      },
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.fornecedor.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(empresaId: number, id: string) {
    const fornecedor = await this.prisma.fornecedor.findFirst({
      where: { id, empresaId },
    });

    if (!fornecedor) {
      throw new NotFoundException(
        `Fornecedor com o ID ${id} não foi encontrado nesta empresa.`,
      );
    }

    return fornecedor;
  }

  async update(empresaId: number, id: string, updateFornecedorDto: UpdateFornecedorDto) {
    await this.findOne(empresaId, id);

    return this.prisma.fornecedor.update({
      where: { id },
      data: updateFornecedorDto,
    });
  }

  async remove(empresaId: number, id: string) {
    await this.findOne(empresaId, id);

    return this.prisma.fornecedor.delete({
      where: { id },
    });
  }
}