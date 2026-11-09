import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusEmpresa, NomeModulo } from '@prisma/client';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';
import { CriarPlanoDto, AtualizarPlanoDto } from './dto/criar-plano.dto';
import * as bcrypt from 'bcrypt';

// Never allow a new store to shadow platform/admin, public or app routes.
const RESERVED_SLUGS = new Set([
  'saas','api','admin','acessar','login','logout','dashboard','pdv',
  'primeiro-acesso','produtos','clientes','funcionarios','categorias',
  'lotes','estoque','financeiro','caixas','vendas','delivery','fiados',
  'vasilhames','fornecedores','relatorios','configuracoes','assets',
  'static','www','health','favicon.ico','robots.txt',
]);

@Injectable()
export class SaasService {
  constructor(private readonly prisma: PrismaService) {}

  async criarEmpresa(dto: CriarEmpresaDto) {
    const cnpj = dto.documento.replace(/\D/g, '');
    const subdominio = dto.subdominio.trim().toLowerCase();
    if (RESERVED_SLUGS.has(subdominio)) {
      throw new ConflictException('Esse endereço é reservado pela plataforma Bebfy. Escolha outro identificador.');
    }
    const email = dto.email.trim().toLowerCase();
    if (!/^\d{14}$/.test(cnpj)) {
      throw new ConflictException('CNPJ precisa conter 14 dígitos.');
    }
    const [existente, usuarioExistente, plano] = await Promise.all([
      this.prisma.empresa.findFirst({
        where: { OR: [{ cnpj }, { subdominio }, { slug: subdominio }] },
      }),
      this.prisma.usuario.findUnique({ where: { email } }),
      this.prisma.plano.findUnique({ where: { id: dto.planoId } }),
    ]);
    if (existente) {
      throw new ConflictException('Empresa já existente com este CNPJ ou subdomínio.');
    }
    if (usuarioExistente) {
      throw new ConflictException('E-mail do responsável já cadastrado.');
    }
    if (!plano) throw new NotFoundException('Plano de assinatura não encontrado.');

    const hash = await bcrypt.hash(dto.senhaInicial, 12);
    return this.prisma.$transaction(async tx => {
      const empresa = await tx.empresa.create({
        data: {
          nomeFantasia: dto.nome,
          razaoSocial: dto.nome,
          cnpj,
          subdominio,
          slug: subdominio,
          planoId: dto.planoId,
          status: StatusEmpresa.EM_TESTE,
        },
      });
      await tx.configGlobal.create({
        data: {
          empresaId: empresa.id,
          nomeEmpresa: dto.nome,
          cnpj,
          telefone: dto.telefone,
        },
      });
      const responsavel = await tx.funcionario.create({
        data: {
          empresaId: empresa.id,
          nome: dto.nomeResponsavel,
          cpf: dto.cpfResponsavel,
          telefone: dto.telefone,
          cargo: 'PROPRIETARIO',
          codigo: 1,
          usuario: {
            create: {
              email,
              senha: hash,
              primeiroAcesso: true,
              permissoes: [],
              ativo: true,
            },
          },
        },
        select: { id: true, nome: true, cargo: true, codigo: true },
      });
      return { empresa, responsavel };
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
        historicoLiberacoes: { orderBy: { criadoEm: 'desc' }, take: 20 },
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

  async definirInadimplencia(id: number, inadimplente: boolean) {
    await this.buscarEmpresaPorId(id);
    return this.prisma.empresa.update({
      where: { id },
      data: { inadimplente, liberacaoFinanceiraAte: null },
    });
  }

  async liberarTemporariamente(id: number, operadorId: string, dias: number, motivo: string) {
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) throw new BadRequestException('Escolha de 1 a 90 dias.');
    if (!motivo?.trim() || motivo.trim().length < 8) throw new BadRequestException('Informe justificativa de no mínimo 8 caracteres.');
    const empresa = await this.buscarEmpresaPorId(id);
    if (!empresa.inadimplente) throw new BadRequestException('Essa empresa não está marcada como inadimplente.');
    if (!['ATIVA', 'EM_TESTE'].includes(empresa.status)) throw new BadRequestException('Empresa suspensa ou cancelada não pode receber liberação financeira.');
    const base = empresa.liberacaoFinanceiraAte && empresa.liberacaoFinanceiraAte.getTime() > Date.now() ? empresa.liberacaoFinanceiraAte.getTime() : Date.now();
    const liberadoAte = new Date(base + dias * 24 * 60 * 60 * 1000);
    return this.prisma.$transaction(async tx => {
      await tx.saasLiberacaoAcesso.create({
        data: { empresaId: id, operadorId, dias, motivo: motivo.trim(), liberadoAte },
      });
      return tx.empresa.update({ where: { id }, data: { liberacaoFinanceiraAte: liberadoAte } });
    });
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

  async criarPlano(dto: CriarPlanoDto) {
    return this.prisma.plano.create({
      data: { nome: dto.nome, tipo: dto.tipo, precoMensal: dto.precoMensal },
    });
  }

  async atualizarPlano(id: number, dto: AtualizarPlanoDto) {
    const existe = await this.prisma.plano.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Plano não encontrado.');
    return this.prisma.plano.update({
      where: { id },
      data: { ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.precoMensal !== undefined ? { precoMensal: dto.precoMensal } : {}) },
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