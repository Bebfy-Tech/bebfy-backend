// Importamos os decoradores e exceções do NestJS
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
// Importamos o PrismaService
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';

@Injectable()
export class FuncionariosService {
  constructor(private readonly prisma: PrismaService) {}

async create(createFuncionarioDto: CreateFuncionarioDto, empresaId: number = 1) {

const funcionarioExiste = await this.prisma.funcionario.findFirst({
  where: {
    empresaId,
    cpf: createFuncionarioDto.cpf,
  },
});

if (funcionarioExiste) {
  throw new ConflictException('Já existe um funcionário com este CPF nesta empresa.');
}

  if (funcionarioExiste) {
    throw new ConflictException('Já existe um funcionário com este CPF nesta empresa.');
  }

  return this.prisma.funcionario.create({
    data: {
      ...createFuncionarioDto,
      empresaId,
    },
  });
}

  // Busca todos os funcionários cadastrados
  async findAll() {
    return this.prisma.funcionario.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            permissoes: true,
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  // Busca um funcionário específico pelo ID (UUID)
  async findOne(id: string) {
    const funcionario = await this.prisma.funcionario.findUnique({
      where: { id },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            permissoes: true,
          },
        },
      },
    });

    if (!funcionario) {
      throw new NotFoundException(`Funcionário com o ID ${id} não foi encontrado.`);
    }

    return funcionario;
  }

  // Atualiza os dados cadastrais, cargo ou desconto do funcionário
  async update(id: string, updateFuncionarioDto: UpdateFuncionarioDto) {
    await this.findOne(id);

    return this.prisma.funcionario.update({
      where: { id },
      data: updateFuncionarioDto,
    });
  }

  // Remove o registo de um funcionário
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.funcionario.delete({
      where: { id },
    });
  }
}
