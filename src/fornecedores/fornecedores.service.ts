import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFornecedorDto: CreateFornecedorDto) {
    const cnpjExiste = await this.prisma.fornecedor.findUnique({
      where: { cnpj: createFornecedorDto.cnpj },
    });

    if (cnpjExiste) {
      throw new ConflictException(
        'Já existe um fornecedor cadastrado com este CNPJ.',
      );
    }

    return this.prisma.fornecedor.create({
      data: createFornecedorDto,
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