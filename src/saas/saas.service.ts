import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { StatusEmpresa, NomeModulo } from '@prisma/client';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';
import { CriarCobrancaSaasDto } from './dto/cobranca-saas.dto';
import { RegistrarPagamentoSaasDto } from './dto/registrar-pagamento-saas.dto';
import { AtualizarEmpresaSaasDto } from './dto/atualizar-empresa-saas.dto';
import { CriarPlanoDto, AtualizarPlanoDto } from './dto/criar-plano.dto';
import * as bcrypt from 'bcrypt';

// Never allow a new store to shadow platform/admin, public or app routes.
const RESERVED_SLUGS = new Set([
  'saas','api','admin','acessar','login','logout','dashboard','pdv',
  'primeiro-acesso','recuperar-senha','produtos','clientes','funcionarios','categorias',
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

  // Consolidated data for the SaaS administrative finance center. All access is
  // guarded by EMPRESAS in the controller; no tenant can call these endpoints.
  async listarFinanceiro() {
    const [empresas, cobrancas] = await Promise.all([
      this.prisma.empresa.findMany({
        select: { id: true, nomeFantasia: true, slug: true, status: true,
          inadimplente: true, liberacaoFinanceiraAte: true,
          plano: { select: { nome: true, precoMensal: true } } },
        orderBy: { nomeFantasia: 'asc' },
      }),
      this.prisma.saasCobranca.findMany({
        include: { pagamentos: { orderBy: { pagoEm: 'desc' } } },
        orderBy: { vencimento: 'desc' },
      }),
    ]);
    const now = Date.now();
    const resultado = cobrancas.map(c => {
      const valorCentavos = Math.round(Number(c.valor) * 100);
      const recebidoCentavos = c.pagamentos.length
        ? c.pagamentos.reduce((sum, p) => sum + Math.round(Number(p.valor) * 100), 0)
        : c.pagoEm ? valorCentavos : 0;
      const saldoCentavos = Math.max(0, valorCentavos - recebidoCentavos);
      const status = saldoCentavos === 0 ? 'PAGO'
        : new Date(c.vencimento).getTime() < now ? 'VENCIDO'
        : recebidoCentavos ? 'PARCIAL' : 'PENDENTE';
      return { ...c, valor: Number(c.valor), recebido: recebidoCentavos / 100,
        saldo: saldoCentavos / 100, status,
        pagamentos: c.pagamentos.map(p => ({ ...p, valor: Number(p.valor) })) };
    });
    return { empresas, cobrancas: resultado };
  }

  async historicoFinanceiro(empresaId: number) {
    await this.buscarEmpresaPorId(empresaId);
    return this.prisma.saasFinanceiroEvento.findMany({
      where: { empresaId }, orderBy: { criadoEm: 'desc' }, take: 100,
    });
  }

  async registrarPagamento(empresaId: number, cobrancaId: string, operadorId: string, dto: RegistrarPagamentoSaasDto) {
    const pagoEm = new Date(dto.pagoEm);
    if (Number.isNaN(pagoEm.getTime()) || pagoEm.getTime() > Date.now() + 86400000) {
      throw new BadRequestException('Data de pagamento inválida.');
    }
    if (!dto.forma.trim()) throw new BadRequestException('Informe a forma de pagamento.');
    const valorCentavos = Math.round(dto.valor * 100);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) throw new BadRequestException('Valor inválido.');
    return this.prisma.$transaction(async tx => {
      // Row lock prevents concurrent payment requests from exceeding the charge.
      await tx.$queryRaw`SELECT "id" FROM "saas_cobrancas"
        WHERE "id" = ${cobrancaId} AND "empresaId" = ${empresaId} FOR UPDATE`;
      const cobranca = await tx.saasCobranca.findFirst({
        where: { id: cobrancaId, empresaId },
        include: { pagamentos: true },
      });
      if (!cobranca) throw new NotFoundException('Cobrança não encontrada nesta distribuidora.');
      if (cobranca.pagoEm && !cobranca.pagamentos.length) {
        throw new ConflictException('Cobrança já quitada no controle anterior. Não registre pagamento duplicado.');
      }
      const totalCentavos = Math.round(Number(cobranca.valor) * 100);
      const recebido = cobranca.pagamentos.reduce((n, p) => n + Math.round(Number(p.valor) * 100), 0);
      if (valorCentavos > totalCentavos - recebido) {
        throw new BadRequestException('Pagamento excede o saldo restante da cobrança.');
      }
      const pagamento = await tx.saasPagamento.create({
        data: { cobrancaId, valor: dto.valor, pagoEm, forma: dto.forma.trim(),
          observacao: dto.observacao?.trim() || null, operadorId },
      });
      if (recebido + valorCentavos === totalCentavos) {
        await tx.saasCobranca.update({ where: { id: cobrancaId }, data: { pagoEm } });
      }
      await tx.saasFinanceiroEvento.create({
        data: { empresaId, operadorId, acao: 'PAGAMENTO_REGISTRADO',
          descricao: 'Pagamento de R$ ' + dto.valor.toFixed(2) + ' registrado na cobrança ' + cobranca.referencia },
      });
      return { ...pagamento, valor: Number(pagamento.valor) };
    });
  }

  async listarCobrancas(empresaId: number) {
    await this.buscarEmpresaPorId(empresaId);
    return this.prisma.saasCobranca.findMany({
      where: { empresaId }, orderBy: { vencimento: 'desc' },
      take: 200,
    });
  }

  async criarCobranca(empresaId: number, dto: CriarCobrancaSaasDto) {
    await this.buscarEmpresaPorId(empresaId);
    const data=new Date(dto.vencimento);
    if(Number.isNaN(data.getTime()))throw new BadRequestException('Vencimento inválido.');
    return this.prisma.saasCobranca.create({
      data: {
        empresaId, referencia:dto.referencia.trim(), valor:dto.valor,
        vencimento:data, linhaDigitavel:dto.linhaDigitavel?.trim()||null,
        observacao:dto.observacao?.trim()||null,
      },
    });
  }

  async marcarPagamento(empresaId: number, cobrancaId: string, pago: boolean, operadorId?: string) {
    const existing = await this.prisma.saasCobranca.findFirst({
      where: { id: cobrancaId, empresaId }, include: { pagamentos: true },
    });
    if (!existing) throw new NotFoundException('Cobrança não encontrada nesta distribuidora.');
    if (existing.pagamentos.length) {
      throw new ConflictException('Essa cobrança possui pagamentos detalhados. Use o controle financeiro para registrar novos pagamentos.');
    }
    return this.prisma.$transaction(async tx => {
      const changed = await tx.saasCobranca.update({
        where: { id: cobrancaId }, data: { pagoEm: pago ? new Date() : null },
      });
      if (operadorId) await tx.saasFinanceiroEvento.create({
        data: { empresaId, operadorId, acao: pago ? 'QUITACAO_MANUAL' : 'ESTORNO_MANUAL',
          descricao: (pago ? 'Quitação manual registrada: ' : 'Quitação manual desfeita: ') + existing.referencia },
      });
      return changed;
    });
  }

  async definirInadimplencia(id: number, inadimplente: boolean, operadorId?: string) {
    await this.buscarEmpresaPorId(id);
    return this.prisma.$transaction(async tx => {
      const empresa = await tx.empresa.update({
        where: { id }, data: { inadimplente, liberacaoFinanceiraAte: null },
      });
      if (operadorId) await tx.saasFinanceiroEvento.create({
        data: { empresaId: id, operadorId,
          acao: inadimplente ? 'BLOQUEIO_FINANCEIRO' : 'DESBLOQUEIO_FINANCEIRO',
          descricao: inadimplente ? 'Bloqueio por inadimplência aplicado' : 'Bloqueio financeiro removido' },
      });
      return empresa;
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
      await tx.saasFinanceiroEvento.create({
        data: { empresaId: id, operadorId, acao: 'LIBERACAO_TEMPORARIA',
          descricao: dias + ' dias até ' + liberadoAte.toISOString() + ' · ' + motivo.trim() },
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

  async listarDescricoesModulos() {
    return this.prisma.saasModuloDescricao.findMany();
  }

  async personalizarModulo(modulo: string, dto: {nome:string;descricao:string}) {
    if (!Object.values(NomeModulo).includes(modulo as NomeModulo)) {
      throw new BadRequestException('Módulo não pertence ao catálogo fixo.');
    }
    const key=modulo as NomeModulo;
    return this.prisma.saasModuloDescricao.upsert({
      where: { modulo: key },
      create: { modulo: key, nome: dto.nome.trim(), descricao: dto.descricao.trim() },
      update: { nome: dto.nome.trim(), descricao: dto.descricao.trim() },
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