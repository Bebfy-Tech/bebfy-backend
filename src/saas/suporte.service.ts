import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { IniciarSessaoSuporteDto } from './dto/iniciar-sessao-suporte.dto';

@Injectable()
export class SuporteService {
  constructor(private readonly prisma: PrismaService) {}

  async iniciar(administradorId: string, dto: IniciarSessaoSuporteDto, ip?: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      select: { id: true, nomeFantasia: true },
    });
    if (!empresa) throw new NotFoundException('Distribuidora não encontrada.');

    const expiraEm = new Date(Date.now() + 15 * 60 * 1000);
    const sessao = await this.prisma.$transaction(async tx => {
      const criada = await tx.sessaoSuporte.create({
        data: {
          administradorId, empresaId: empresa.id,
          motivo: dto.motivo.trim(), ticket: dto.ticket.trim(), expiraEm,
        },
      });
      await tx.logAuditoria.create({
        data: {
          empresaId: empresa.id,
          usuarioId: administradorId,
          acao: 'SUPORTE_SESSAO_INICIADA',
          entidade: 'SessaoSuporte', entidadeId: criada.id,
          detalhes: JSON.stringify({ ticket: criada.ticket, consentimentoConfirmado: dto.consentimentoConfirmado, expiraEm: criada.expiraEm.toISOString() }),
          ip: ip || null,
        },
      });
      return criada;
    });
    return {
      id: sessao.id, empresaId: sessao.empresaId, empresa: empresa.nomeFantasia,
      ticket: sessao.ticket, expiraEm: sessao.expiraEm,
      modo: 'LEITURA_DIAGNOSTICO' as const,
      aviso: 'Acesso de suporte somente leitura e com auditoria. Não permite atuar como funcionário.',
    };
  }

  private async validarSessao(administradorId: string, id: string) {
    const sessao = await this.prisma.sessaoSuporte.findUnique({ where: { id } });
    if (!sessao || sessao.administradorId !== administradorId ||
        sessao.revogadoEm || sessao.expiraEm.getTime() <= Date.now()) {
      throw new ForbiddenException('Sessão de suporte inválida, encerrada ou expirada.');
    }
    return sessao;
  }

  async diagnostico(administradorId: string, id: string, ip?: string) {
    const sessao = await this.validarSessao(administradorId, id);
    return this.prisma.$transaction(async tx => {
      const [empresa, produtos, funcionarios, clientes, caixasAbertos, vendas] = await Promise.all([
        tx.empresa.findUnique({ where: { id: sessao.empresaId },
          select: { id: true, nomeFantasia: true, slug: true, status: true, plano: { select: { nome: true } } } }),
        tx.produto.count({ where: { empresaId: sessao.empresaId } }),
        tx.funcionario.count({ where: { empresaId: sessao.empresaId } }),
        tx.cliente.count({ where: { empresaId: sessao.empresaId } }),
        tx.caixa.count({ where: { empresaId: sessao.empresaId, status: 'ABERTO' } }),
        tx.venda.count({ where: { empresaId: sessao.empresaId } }),
      ]);
      await tx.logAuditoria.create({
        data: {
          empresaId: sessao.empresaId, usuarioId: administradorId,
          acao: 'SUPORTE_DIAGNOSTICO_CONSULTADO', entidade: 'SessaoSuporte',
          entidadeId: id, detalhes: JSON.stringify({ ticket: sessao.ticket }), ip: ip || null,
        },
      });
      return {
        empresa, sessaoId: id, expiraEm: sessao.expiraEm,
        dadosAgregados: { produtos, funcionarios, clientes, caixasAbertos, vendas },
        somenteLeitura: true,
      };
    });
  }

  async encerrar(administradorId: string, id: string, ip?: string) {
    const sessao = await this.validarSessao(administradorId, id);
    return this.prisma.$transaction(async tx => {
      const alterada = await tx.sessaoSuporte.updateMany({
        where: { id, administradorId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      if (!alterada.count) throw new ForbiddenException('Sessão já encerrada.');
      await tx.logAuditoria.create({
        data: {
          empresaId: sessao.empresaId, usuarioId: administradorId,
          acao: 'SUPORTE_SESSAO_ENCERRADA', entidade: 'SessaoSuporte',
          entidadeId: id, detalhes: JSON.stringify({ ticket: sessao.ticket }), ip: ip || null,
        },
      });
      return { encerrada: true, sessaoId: id };
    });
  }
}
