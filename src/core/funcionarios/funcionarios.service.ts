import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { ConfigurarAcessoDto } from './dto/configurar-acesso.dto';
import * as bcrypt from 'bcrypt';

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

  async configurarAcesso(id: string, empresaId: number, dto: ConfigurarAcessoDto) {
    const funcionario = await this.findOne(id, empresaId);
    if (!funcionario.ativo) {
      throw new ConflictException('Não é possível liberar acesso para funcionário inativo.');
    }
    const email = dto.email.toLowerCase().trim();
    const conflito = await this.prisma.usuario.findFirst({
      where: { email, NOT: { funcionarioId: id } },
    });
    if (conflito) throw new ConflictException('E-mail de acesso já utilizado.');

    if (dto.codigo != null) {
      const codigoEmUso = await this.prisma.funcionario.findFirst({
        where: { empresaId, codigo: dto.codigo, NOT: { id } },
      });
      if (codigoEmUso) throw new ConflictException('Código de operador já utilizado nesta empresa.');
    }

    const hash = await bcrypt.hash(dto.senha, 12);
    return this.prisma.$transaction(async tx => {
      if (dto.codigo != null) {
        await tx.funcionario.update({
          where: { id }, data: { codigo: dto.codigo },
        });
      }
      return tx.usuario.upsert({
        where: { funcionarioId: id },
        create: {
          funcionarioId: id, email, senha: hash, primeiroAcesso: true,
          permissoes: dto.permissoes, ativo: true,
        },
        update: {
          email, senha: hash, primeiroAcesso: true, sessaoId: null,
          permissoes: dto.permissoes, ativo: true,
        },
        select: { id: true, email: true, ativo: true, permissoes: true },
      });
    });
  }

  async remove(id: string, empresaId: number) {
    await this.findOne(id, empresaId);
    // Desativação lógica preserva o histórico de vendas e auditoria.
    return this.prisma.funcionario.update({ where: { id }, data: { ativo: false } });
  }
}
