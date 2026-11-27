import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CriarCompraDto } from './compras.dto';
import { converterQuantidade, dataCompra, ratearTotal } from './compras-regras';

type Tx = Prisma.TransactionClient;
const incluir = { itens: { orderBy: { produtoId: 'asc' as const } } };
const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

@Injectable()
export class ComprasService {
  constructor(private readonly prisma: PrismaService) {}

  private async serial<T>(fn: (tx: Tx) => Promise<T>) {
    try {
      return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code))
        throw new ConflictException('Operação repetida ou concorrente. Atualize e confira o pedido.');
      throw e;
    }
  }

  private async obter(tx: Tx, empresaId: number, id: string) {
    const c = await tx.compra.findFirst({ where: { empresaId, id }, include: incluir });
    if (!c) throw new NotFoundException('Pedido não encontrado nesta empresa.');
    return c;
  }

  async ficha(empresaId: number, id: string) {
    return this.obter(this.prisma, empresaId, id);
  }
  async listar(empresaId: number) {
    return this.prisma.compra.findMany({ where: { empresaId }, include: incluir, orderBy: { criadoEm: 'desc' } });
  }
  async referencias(empresaId: number) {
    const [fornecedores, produtos] = await Promise.all([
      this.prisma.fornecedor.findMany({ where: { empresaId, ativo: true }, select: { id: true, razaoSocial: true, nomeFantasia: true }, orderBy: { razaoSocial: 'asc' } }),
      this.prisma.produto.findMany({ where: { empresaId, ativo: true }, select: { id: true, nome: true, codigoBarras: true, estoqueAtual: true, estoqueMinimo: true, unidadeMedida: true, unidadeEmbalagemSigla: true, fardoQuantidade: true, precoCusto: true, precoVendaVarejo: true }, orderBy: { nome: 'asc' } }),
    ]);
    return { fornecedores, produtos };
  }

  private async fornecedorAtivo(tx: Tx, empresaId: number, id: string) {
    const f = await tx.fornecedor.findFirst({ where: { empresaId, id, ativo: true } });
    if (!f) throw new BadRequestException('Fornecedor indisponível nesta empresa.');
    const lock = await tx.fornecedor.updateMany({ where: { empresaId, id, ativo: true }, data: { ativo: true } });
    if (!lock.count) throw new ConflictException('Fornecedor alterado.');
    return f;
  }

  async criar(empresaId: number, dto: CriarCompraDto, operadorId: string) {
    const itens = [...dto.itens].sort((a, b) => a.produtoId - b.produtoId);
    if (!itens.length || new Set(itens.map(i => i.produtoId)).size !== itens.length)
      throw new BadRequestException('Inclua cada produto apenas uma vez no pedido.');
    const previsao = dto.previsaoEntrega ? dataCompra(dto.previsaoEntrega) : null;
    const observacao = dto.observacao?.trim() || null;
    return this.serial(async tx => {
      const existente = await tx.compra.findFirst({ where: { empresaId, chaveOperacao: dto.chaveOperacao }, include: incluir });
      if (existente) {
        const igual = existente.fornecedorId === dto.fornecedorId
          && existente.frete.equals(dto.frete) && existente.desconto.equals(dto.desconto)
          && (existente.previsaoEntrega?.getTime() ?? null) === (previsao?.getTime() ?? null)
          && existente.observacao === observacao && existente.itens.length === itens.length
          && existente.itens.every((x, n) => x.produtoId === itens[n].produtoId
            && x.quantidade === itens[n].quantidade && x.custoEmbalagem.equals(itens[n].custoEmbalagem)
            && (x.fator > 1 ? 'EMBALAGEM' : 'BASE') === itens[n].modo);
        if (!igual) throw new ConflictException('Chave de operação utilizada com outros dados.');
        return existente;
      }
      const f = await this.fornecedorAtivo(tx, empresaId, dto.fornecedorId);
      const rows = [];
      for (const i of itens) {
        const p = await tx.produto.findFirst({ where: { empresaId, id: i.produtoId, ativo: true } });
        if (!p) throw new BadRequestException('Produto indisponível nesta empresa.');
        const fator = i.modo === 'EMBALAGEM' ? p.fardoQuantidade ?? 1 : 1;
        if (i.modo === 'EMBALAGEM' && fator <= 1) throw new BadRequestException('Produto sem embalagem configurada.');
        const unidades = converterQuantidade(i.quantidade, fator);
        const custo = d(i.custoEmbalagem);
        rows.push({
          produtoId: p.id, produtoNome: p.nome, unidadeBase: p.unidadeMedida,
          unidadeCompra: i.modo === 'EMBALAGEM' ? p.unidadeEmbalagemSigla ?? 'FD' : p.unidadeMedida,
          fator, quantidade: i.quantidade, unidades, custoEmbalagem: custo, subtotal: custo.mul(i.quantidade),
        });
      }
      const frete = d(dto.frete), desconto = d(dto.desconto);
      const calc = ratearTotal(rows.map(r => r.subtotal), frete, desconto);
      // Pedido não é recebimento: nenhum saldo, custo ou conta a pagar é alterado aqui.
      return tx.compra.create({
        data: { empresaId, fornecedorId: f.id, fornecedorNome: f.razaoSocial,
          operadorId, chaveOperacao: dto.chaveOperacao, previsaoEntrega: previsao, observacao,
          frete, desconto, subtotal: calc.subtotal, total: calc.total,
          itens: { create: rows.map((r, i) => ({ ...r, total: calc.itens[i] })) } },
        include: incluir,
      });
    });
  }

  async confirmar(empresaId: number, id: string, operadorId: string) {
    return this.serial(async tx => {
      const c = await this.obter(tx, empresaId, id);
      if (c.status === 'AGUARDANDO') return c;
      if (c.status !== 'RASCUNHO') throw new BadRequestException('Pedido não está em rascunho.');
      await this.fornecedorAtivo(tx, empresaId, c.fornecedorId);
      for (const i of c.itens) {
        const p = await tx.produto.findFirst({ where: { empresaId, id: i.produtoId, ativo: true, unidadeMedida: i.unidadeBase } });
        if (!p) throw new BadRequestException('Produto inativo ou unidade de estoque alterada. Revise o pedido.');
      }
      const r = await tx.compra.updateMany({ where: { empresaId, id, status: 'RASCUNHO' }, data: { status: 'AGUARDANDO', confirmadoEm: new Date(), confirmadoPor: operadorId } });
      if (!r.count) throw new ConflictException('Pedido alterado.');
      return this.obter(tx, empresaId, id);
    });
  }

  async encerrar(empresaId: number, id: string, motivo: string, operadorId: string) {
    const texto = motivo.trim();
    if (!texto) throw new BadRequestException('Informe o motivo do cancelamento.');
    return this.serial(async tx => {
      const c = await this.obter(tx, empresaId, id);
      if (['CANCELADA', 'ENCERRADA_PARCIAL'].includes(c.status) && c.motivoEncerramento === texto) return c;
      if (!['RASCUNHO', 'AGUARDANDO', 'PARCIAL'].includes(c.status)) throw new BadRequestException('Pedido não pode ser cancelado.');
      const status = c.itens.some(i => i.unidadesRecebidas > 0) ? 'ENCERRADA_PARCIAL' : 'CANCELADA';
      const r = await tx.compra.updateMany({ where: { empresaId, id, status: c.status }, data: { status, encerradoEm: new Date(), encerradoPor: operadorId, motivoEncerramento: texto } });
      if (!r.count) throw new ConflictException('Pedido alterado.');
      return this.obter(tx, empresaId, id);
    });
  }
}
