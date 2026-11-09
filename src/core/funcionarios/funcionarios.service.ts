import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';

@Injectable()
export class FuncionariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFuncionarioDto, empresaId: number) {
    const existente = await this.prisma.funcionario.findFirst({
      where: { empresaId, cpf: dto.cpf },
    });
    if (existente) {
      throw new ConflictException('Já existe um funcionário com este CPF nesta empresa.');
    }
    return this.prisma.funcionario.create({ data: { ...dto, empresaId } });
  }

  async findAll(empresaId: number) {
    return this.prisma.funcionario.findMany({
      where: { empresaId },
      include: { usuario: { select: { id: true, email: true, permissoes: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, empresaId: number) {
    const funcionario = await this.prisma.funcionario.findFirst({
      where: { id, empresaId },
      include: { usuario: { select: { id: true, email: true, permissoes: true } } },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado nesta empresa.');
    }
    return funcionario;
  }

  async update(id: string, dto: UpdateFuncionarioDto, empresaId: number) {
    await this.findOne(id, empresaId);
    return this.prisma.funcionario.update({ where: { id }, data: dto });
  }

  async remove(id: string, empresaId: number) {
    await this.findOne(id, empresaId);
    // Desativação lógica preserva o histórico de vendas e auditoria.
    return this.prisma.funcionario.update({ where: { id }, data: { ativo: false } });
  }
}
