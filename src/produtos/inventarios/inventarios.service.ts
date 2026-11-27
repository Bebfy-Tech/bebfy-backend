import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { resolverModulos } from '../../common/modulos/plano-modulos';

type Contagem = { produtoId: number; contagem: number };
type ContagemLote = { produtoId: number; loteId: number; contagem: number };
type LoteConferencia = { loteId: number; numeroLote: string | null; validade: string | null; saldoInicial: number; contagem: number | null; contadoPorId: string | null; contadoEm: string | null };
const lerLotes = (v: Prisma.JsonValue | undefined): LoteConferencia[] | null =>
  Array.isArray(v) ? v as unknown as LoteConferencia[] : null;
const jsonLotes = (v: LoteConferencia[]): Prisma.InputJsonValue => v as unknown as Prisma.InputJsonValue;
const loteSelect = { id: true, numeroLote: true, dataVencimento: true, quantidade: true } as const;
const LIMITE = 5000;
const detalhe = { itens: { orderBy: [{ nome: 'asc' as const }, { produtoId: 'asc' as const }] } };

@Injectable()
export class InventariosService {
  constructor(private readonly prisma: PrismaService) {}

  // Toda mutação usa transação serializável e controle de revisão.
  private async transacao<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code))
        throw new ConflictException('Operação concorrente. Atualize o inventário e tente novamente.');
      throw e;
    }
  }

  private async lotesAtivos(tx: Prisma.TransactionClient, empresaId: number) {
    const empresa = await tx.empresa.findUniqueOrThrow({ where: { id: empresaId }, select: { plano: { select: { modulosPadrao: true } }, modulosAtivos: { select: { modulo: true, ativo: true } } } });
    return resolverModulos(empresa).ESTOQUE_LOTES;
  }

  listar(empresaId: number) {
    return this.prisma.inventarioEstoque.findMany({
      where: { empresaId }, orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }], take: 50,
      select: { id: true, status: true, revisao: true, criadoEm: true, encerradoEm: true, abertoPorId: true, encerradoPorId: true, _count: { select: { itens: true } } },
    });
  }

  private async buscar(tx: Prisma.TransactionClient, empresaId: number, id: string) {
    const inventario = await tx.inventarioEstoque.findFirst({ where: { id, empresaId }, include: detalhe });
    if (!inventario) throw new NotFoundException('Inventário não encontrado.');
    return inventario;
  }

  ficha(empresaId: number, id: string) { return this.buscar(this.prisma, empresaId, id); }

  criar(empresaId: number, funcionarioId: string) {
    return this.transacao(async tx => {
      if (await tx.inventarioEstoque.findFirst({ where: { empresaId, status: 'ABERTO' }, select: { id: true } }))
        throw new ConflictException('Já existe um inventário aberto nesta empresa.');
      const habilitado = await this.lotesAtivos(tx, empresaId);
      const produtos = await tx.produto.findMany({ where: { empresaId, ativo: true }, take: LIMITE + 1,
        select: { id: true, nome: true, codigoBarras: true, estoqueAtual: true, atualizadoEm: true, lotes: { where: { empresaId }, select: loteSelect, orderBy: { id: 'asc' } } } });
      if (!produtos.length || produtos.length > LIMITE)
        throw new BadRequestException('A contagem completa exige de 1 a 5000 produtos ativos.');
      return tx.inventarioEstoque.create({
        data: { empresaId, abertoPorId: funcionarioId, itens: { createMany: { data: produtos.map(p => ({
          produtoId: p.id, nome: p.nome, codigoBarras: p.codigoBarras, saldoInicial: p.estoqueAtual, produtoAtualizadoEm: p.atualizadoEm,
          ...(habilitado || !p.lotes.length ? { lotesConferencia: jsonLotes(p.lotes.map(l => ({
            loteId: l.id, numeroLote: l.numeroLote, validade: l.dataVencimento?.toISOString() ?? null,
            saldoInicial: l.quantidade, contagem: null, contadoPorId: null, contadoEm: null,
          }))) } : {}),
        })) } } }, include: detalhe,
      });
    });
  }

  private async reservar(tx: Prisma.TransactionClient, empresaId: number, id: string, revisao: number) {
    const r = await tx.inventarioEstoque.updateMany({ where: { id, empresaId, revisao, status: 'ABERTO' }, data: { revisao: { increment: 1 } } });
    if (r.count !== 1) throw new ConflictException('Inventário encerrado ou desatualizado. Reabra a ficha.');
  }

  salvar(empresaId: number, id: string, revisao: number, itens: Contagem[], funcionarioId: string) {
    return this.transacao(async tx => {
      const inv = await this.buscar(tx, empresaId, id);
      const ids = new Set(inv.itens.map(i => i.produtoId));
      if (new Set(itens.map(i => i.produtoId)).size !== itens.length || itens.some(i => !ids.has(i.produtoId)))
        throw new BadRequestException('Produto repetido ou fora do inventário.');
      await this.reservar(tx, empresaId, id, revisao);
      for (const i of itens) {
        await tx.itemInventarioEstoque.update({ where: { inventarioId_produtoId: { inventarioId: id, produtoId: i.produtoId } },
          data: { contagem: i.contagem, contadoPorId: funcionarioId, contadoEm: new Date() } });
      }
      return this.buscar(tx, empresaId, id);
    });
  }

  salvarLotes(empresaId: number, id: string, revisao: number, itens: ContagemLote[], funcionarioId: string) {
    return this.transacao(async tx => {
      const inv = await this.buscar(tx, empresaId, id);
      if (!await this.lotesAtivos(tx, empresaId)) throw new BadRequestException('Módulo de lotes desativado.');
      const chaves = new Set(itens.map(i => i.produtoId + ':' + i.loteId));
      if (chaves.size !== itens.length) throw new BadRequestException('Lote repetido na contagem.');
      const grupos = new Map<number, ContagemLote[]>();
      for (const i of itens) grupos.set(i.produtoId, [...(grupos.get(i.produtoId) ?? []), i]);
      const atualizacoes = [...grupos].map(([produtoId, contagens]) => {
        const item = inv.itens.find(i => i.produtoId === produtoId);
        const lotes = lerLotes(item?.lotesConferencia);
        if (!lotes || contagens.some(c => !lotes.some(l => l.loteId === c.loteId)))
          throw new BadRequestException('Lote fora do inventário.');
        const mapa = new Map(contagens.map(c => [c.loteId, c.contagem]));
        const data = new Date().toISOString();
        return { produtoId, lotes: lotes.map(l => mapa.has(l.loteId) ? { ...l, contagem: mapa.get(l.loteId)!, contadoPorId: funcionarioId, contadoEm: data } : l) };
      });
      await this.reservar(tx, empresaId, id, revisao);
      for (const item of atualizacoes) await tx.itemInventarioEstoque.update({
        where: { inventarioId_produtoId: { inventarioId: id, produtoId: item.produtoId } },
        data: { lotesConferencia: jsonLotes(item.lotes) },
      });
      return this.buscar(tx, empresaId, id);
    });
  }

  encerrar(empresaId: number, id: string, revisao: number, motivo: string, funcionarioId: string, cancelar = false) {
    return this.transacao(async tx => {
      const inv = await this.buscar(tx, empresaId, id);
      await this.reservar(tx, empresaId, id, revisao);
      if (!cancelar) {
        if (inv.itens.some(i => i.contagem === null)) throw new BadRequestException('Conclua todas as contagens antes do fechamento.');
        const atuais = await tx.produto.findMany({ where: { empresaId, ativo: true }, select: { id: true, nome: true, estoqueAtual: true, atualizadoEm: true, _count: { select: { lotes: true } }, lotes: { where: { empresaId }, select: loteSelect, orderBy: { id: 'asc' } } } });
        const mapa = new Map(atuais.map(p => [p.id, p]));
        if (atuais.length !== inv.itens.length) throw new ConflictException('O cadastro de produtos mudou. Cancele e inicie nova contagem.');
        const exigeLotes = inv.itens.some(i => (lerLotes(i.lotesConferencia)?.length ?? 0) > 0);
        if (exigeLotes && !await this.lotesAtivos(tx, empresaId))
          throw new BadRequestException('Reative o módulo de lotes para concluir esta conferência.');
        // Não sobrescrever vendas, compras ou alterações ocorridas durante a contagem.
        for (const i of inv.itens) {
          const p = mapa.get(i.produtoId);
          if (!p || p.estoqueAtual !== i.saldoInicial || p.atualizadoEm.getTime() !== i.produtoAtualizadoEm.getTime())
            throw new ConflictException('Produto alterado durante o inventário: ' + i.nome + '. Cancele e refaça a contagem.');
          const lotes = lerLotes(i.lotesConferencia);
          if (lotes === null) {
            if (i.contagem !== i.saldoInicial && p._count.lotes > 0)
              throw new BadRequestException('Divergência em produto com lotes: ' + i.nome + '. Requer novo inventário com o módulo de lotes ativo.');
            continue;
          }
          if (p.lotes.length !== lotes.length || lotes.some(l => !p.lotes.some(a => a.id === l.loteId && a.quantidade === l.saldoInicial && a.numeroLote === l.numeroLote && (a.dataVencimento?.toISOString() ?? null) === l.validade)))
            throw new ConflictException('Lotes alterados durante o inventário de ' + i.nome + '. Refaça a contagem.');
          if (lotes.some(l => l.contagem === null)) throw new BadRequestException('Conclua a contagem de todos os lotes de ' + i.nome + '.');
          if (lotes.reduce((total, l) => total + l.contagem!, 0) > i.contagem!)
            throw new BadRequestException('A soma dos lotes supera a contagem física de ' + i.nome + '.');

        }
        // Todas as divergências são aplicadas atomicamente ou nenhuma é aplicada.
        for (const i of inv.itens) {
          const delta = i.contagem! - i.saldoInicial;
          const lotes = lerLotes(i.lotesConferencia) ?? [];
          const alterados = lotes.filter(l => l.contagem !== l.saldoInicial);
          // Mesmo quando o saldo geral não muda, atualize a versão do produto para
          // impedir estornos de compras baseados em um lote já reconciliado.
          if (!delta && !alterados.length) continue;
          const r = await tx.produto.updateMany({ where: { id: i.produtoId, empresaId, ativo: true, estoqueAtual: i.saldoInicial, atualizadoEm: i.produtoAtualizadoEm },
            data: { estoqueAtual: i.contagem! } });
          if (r.count !== 1) throw new ConflictException('Saldo alterado durante o fechamento.');
          for (const l of alterados) {
            const alteracao = await tx.loteProduto.updateMany({
              where: { id: l.loteId, empresaId, produtoId: i.produtoId, quantidade: l.saldoInicial },
              data: { quantidade: l.contagem! },
            });
            if (alteracao.count !== 1) throw new ConflictException('Lote alterado durante o fechamento.');
          }
          // Ajustes exclusivos de lotes ficam no histórico do inventário, sem
          // gerar entrada/saída fictícia no saldo geral.
          if (delta) await tx.movimentacaoEstoque.create({ data: { empresaId, produtoId: i.produtoId, tipo: delta > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA',
            quantidade: Math.abs(delta), motivo: 'Inventário ' + id + ' — ' + motivo, observacao: 'Aprovado por funcionário ' + funcionarioId } });
        }
      }
      await tx.inventarioEstoque.update({ where: { id }, data: { status: cancelar ? 'CANCELADO' : 'FECHADO', encerradoPorId: funcionarioId, encerradoEm: new Date(), motivoEncerramento: motivo } });
      return this.buscar(tx, empresaId, id);
    });
  }
}
