import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusEmpresa, NomeModulo } from '@prisma/client';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';

@Injectable()
export class SaasService {
  constructor(private readonly prisma: PrismaService) {}

  async criarEmpresa(dto: CriarEmpresaDto) {
    const empresaExistente = await this.prisma.empresa.findFirst({
      where: {
        OR: [
          { cnpj: dto.documento },
          { subdominio: dto.subdominio },
        ],
      },
    });

    if (empresaExistente) {
      throw new ConflictException('Já existe uma empresa cadastrada com este CNPJ ou Subdomínio.');
    }

    const plano = await this.prisma.plano.findUnique({
      where: { id: dto.planoId },
    });

    if (!plano) {
      throw new NotFoundException(`Plano com ID ${dto.planoId} não encontrado.`);
    }

    return this.prisma.empresa.create({
      data: {
        nomeFantasia: dto.nome,
        razaoSocial: dto.nome,
        cnpj: dto.documento,
        subdominio: dto.subdominio,
        slug: dto.subdominio || dto.nome.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        planoId: dto.planoId,
        status: StatusEmpresa.EM_TESTE,
      },
      include: {
        plano: true,
      },
    });
  }

  async listarEmpresas() {
    return this.prisma.empresa.findMany({
      include: {
        plano: true,
        modulosAtivos: true,
        _count: {
          select: { funcionarios: true, produtos: true, vendas: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscarEmpresaPorId(id: number) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        plano: true,
        modulosAtivos: true,
        config: true,
        _count: {
          select: { funcionarios: true, produtos: true, vendas: true, clientes: true },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa com ID ${id} não encontrada.`);
    }

    return empresa;
  }

  async alterarStatusEmpresa(id: number, status: StatusEmpresa) {
    await this.buscarEmpresaPorId(id);

    return this.prisma.empresa.update({
      where: { id },
      data: { status },
    });
  }

  async alternarModuloEmpresa(empresaId: number, modulo: NomeModulo, ativo: boolean) {
    await this.buscarEmpresaPorId(empresaId);

    return this.prisma.empresaModulo.upsert({
      where: {
        empresaId_modulo: {
          empresaId,
          modulo,
        },
      },
      update: { ativo },
      create: {
        empresaId,
        modulo,
        ativo,
      },
    });
  }

  async listarPlanos() {
    return this.prisma.plano.findMany({
      orderBy: { precoMensal: 'asc' },
    });
  }

  async alterarPlanoEmpresa(empresaId: number, planoId: number) {
    await this.buscarEmpresaPorId(empresaId);

    const plano = await this.prisma.plano.findUnique({
      where: { id: planoId },
    });

    if (!plano) {
      throw new NotFoundException(`Plano com ID ${planoId} não encontrado.`);
    }

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: { planoId },
      include: { plano: true },
    });
  }
}