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

async create(createFornecedorDto: CreateFornecedorDto, empresaId: number = 1) {
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

  async findAll() {
    return this.prisma.fornecedor.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string) {
    const fornecedor = await this.prisma.fornecedor.findUnique({
      where: { id },
    });

    if (!fornecedor) {
      throw new NotFoundException(
        `Fornecedor com o ID ${id} não foi encontrado.`,
      );
    }

    return fornecedor;
  }

  async update(id: string, updateFornecedorDto: UpdateFornecedorDto) {
    await this.findOne(id);

    return this.prisma.fornecedor.update({
      where: { id },
      data: updateFornecedorDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.fornecedor.delete({
      where: { id },
    });
  }
}
