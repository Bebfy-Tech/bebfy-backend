import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusEmpresa, NomeModulo } from '@prisma/client';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';
import { AtualizarEmpresaSaasDto } from './dto/atualizar-empresa-saas.dto';
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
    const documento = dto.documento.replace(/\D/g, '');
    const subdominio = dto.subdominio.trim().toLowerCase();
    if (RESERVED_SLUGS.has(subdominio)) {
      throw new ConflictException('Esse endereço é reservado pela plataforma Bebfy. Escolha outro identificador.');
    }
    const email = dto.email.trim().toLowerCase();
    if (!/^(?:\d{11}|\d{14})$/.test(documento)) {
      throw new BadRequestException('Documento deve conter 11 dígitos (CPF) ou 14 dígitos (CNPJ).');
    }
    const [existente, usuarioExistente, plano] = await Promise.all([
      this.prisma.empresa.findFirst({
        where: { OR: [{ cnpj: documento }, { subdominio }, { slug: subdominio }] },
      }),
      this.prisma.usuario.findUnique({ where: { email } }),
      this.prisma.plano.findUnique({ where: { id: dto.planoId } }),
    ]);
    if (existente) {
      throw new ConflictException('Empresa já existente com este documento ou subdomínio.');
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
          cnpj: documento,
          subdominio,
          slug: subdominio,
          planoId: dto.planoId,
          status: StatusEmpresa.EM_TESTE,
        },
      });
      // Defaults are saved as explicit access records, so existing module guards keep working.
      if (plano.modulosPadrao.length) {
        await tx.empresaModulo.createMany({
          data: plano.modulosPadrao.map(modulo => ({ empresaId: empresa.id, modulo, ativo: true })),
          skipDuplicates: true,
        });
      }
      await tx.configGlobal.create({
        data: {
          empresaId: empresa.id,
          nomeEmpresa: dto.nome,
          cnpj: documento,
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
        funcionarios: {
          where: { cargo: 'PROPRIETARIO' },
          take: 1,
          select: { id: true, codigo: true, nome: true, cpf: true, telefone: true,
            usuario: { select: { email: true, ativo: true } } },
        },
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


  async editarEmpresa(id: number, dto: AtualizarEmpresaSaasDto) {
    const empresa = await this.buscarEmpresaPorId(id);
    const responsavel = empresa.funcionarios[0];
    if ((dto.emailResponsavel || dto.cpfResponsavel || dto.nomeResponsavel || dto.senhaTemporaria) && !responsavel) {
      throw new BadRequestException('Proprietário não localizado; ajuste o cadastro antes de alterar o acesso.');
    }
    if (dto.documento && dto.documento !== empresa.cnpj) {
      const exists = await this.prisma.empresa.findFirst({ where: { cnpj: dto.documento, NOT: { id } } });
      if (exists) throw new ConflictException('Documento já pertence a outra distribuidora.');
    }
    const email = dto.emailResponsavel?.trim().toLowerCase();
    if (email && email !== responsavel?.usuario?.email) {
      const already = await this.prisma.usuario.findUnique({ where: { email } });
      if (already) throw new ConflictException('E-mail já cadastrado em outra conta.');
    }
    return this.prisma.$transaction(async tx => {
      await tx.empresa.update({
        where: { id },
        data: {
          ...(dto.nomeFantasia !== undefined ? { nomeFantasia: dto.nomeFantasia.trim() } : {}),
          ...(dto.razaoSocial !== undefined ? { razaoSocial: dto.razaoSocial.trim() } : {}),
          ...(dto.documento !== undefined ? { cnpj: dto.documento } : {}),
        },
      });
      if (dto.telefone !== undefined || dto.nomeFantasia !== undefined || dto.documento !== undefined) {
        await tx.configGlobal.upsert({
          where: { empresaId: id },
          create: { empresaId: id, nomeEmpresa: dto.nomeFantasia ?? empresa.nomeFantasia,
            cnpj: dto.documento ?? empresa.cnpj, telefone: dto.telefone },
          update: {
            ...(dto.nomeFantasia !== undefined ? { nomeEmpresa: dto.nomeFantasia.trim() } : {}),
            ...(dto.documento !== undefined ? { cnpj: dto.documento } : {}),
            ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
          },
        });
      }
      if (responsavel && (dto.nomeResponsavel !== undefined || dto.cpfResponsavel !== undefined || dto.telefone !== undefined)) {
        await tx.funcionario.update({
          where: { id: responsavel.id },
          data: {
            ...(dto.nomeResponsavel !== undefined ? { nome: dto.nomeResponsavel.trim() } : {}),
            ...(dto.cpfResponsavel !== undefined ? { cpf: dto.cpfResponsavel } : {}),
            ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
          },
        });
      }
      if (responsavel?.usuario && (email || dto.senhaTemporaria)) {
        await tx.usuario.update({
          where: { funcionarioId: responsavel.id },
          data: {
            ...(email ? { email } : {}),
            ...(dto.senhaTemporaria ? {
              senha: await bcrypt.hash(dto.senhaTemporaria, 12),
              primeiroAcesso: true, sessaoId: null,
            } : {}),
          },
        });
      }
      return tx.empresa.findUnique({
        where: { id },
        include: { plano: true, modulosAtivos: true, config: true,
          funcionarios: { where: { cargo: 'PROPRIETARIO' }, take: 1,
            select: { id: true, codigo: true, nome: true, cpf: true, telefone: true,
              usuario: { select: { email: true, ativo: true } } } } },
      });
    });
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
      data: { nome: dto.nome, tipo: dto.tipo, precoMensal: dto.precoMensal, modulosPadrao: dto.modulosPadrao ?? [] },
    });
  }

  async atualizarPlano(id: number, dto: AtualizarPlanoDto) {
    const existe = await this.prisma.plano.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Plano não encontrado.');
    return this.prisma.plano.update({
      where: { id },
      data: { ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.precoMensal !== undefined ? { precoMensal: dto.precoMensal } : {}),
        ...(dto.modulosPadrao !== undefined ? { modulosPadrao: dto.modulosPadrao } : {}) },
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

    return this.prisma.$transaction(async tx => {
      const empresa = await tx.empresa.update({
        where: { id: empresaId },
        data: { planoId },
        include: { plano: true, modulosAtivos: true },
      });
      // Safely add newly included modules; never silently delete add-ons already granted.
      for (const modulo of plano.modulosPadrao) {
        await tx.empresaModulo.upsert({
          where: { empresaId_modulo: { empresaId, modulo } },
          create: { empresaId, modulo, ativo: true },
          update: { ativo: true },
        });
      }
      return empresa;
    });
  }
}