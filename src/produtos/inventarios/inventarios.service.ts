import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

type Contagem = { produtoId: number; contagem: number };
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
      const produtos = await tx.produto.findMany({ where: { empresaId, ativo: true }, take: LIMITE + 1,
        select: { id: true, nome: true, codigoBarras: true, estoqueAtual: true, atualizadoEm: true } });
      if (!produtos.length || produtos.length > LIMITE)
        throw new BadRequestException('A contagem completa exige de 1 a 5000 produtos ativos.');
      return tx.inventarioEstoque.create({
        data: { empresaId, abertoPorId: funcionarioId, itens: { createMany: { data: produtos.map(p => ({
          produtoId: p.id, nome: p.nome, codigoBarras: p.codigoBarras, saldoInicial: p.estoqueAtual, produtoAtualizadoEm: p.atualizadoEm,
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

  encerrar(empresaId: number, id: string, revisao: number, motivo: string, funcionarioId: string, cancelar = false) {
    return this.transacao(async tx => {
      const inv = await this.buscar(tx, empresaId, id);
      await this.reservar(tx, empresaId, id, revisao);
      if (!cancelar) {
        if (inv.itens.some(i => i.contagem === null)) throw new BadRequestException('Conclua todas as contagens antes do fechamento.');
        const atuais = await tx.produto.findMany({ where: { empresaId, ativo: true }, select: { id: true, nome: true, estoqueAtual: true, atualizadoEm: true, _count: { select: { lotes: true } } } });
        const mapa = new Map(atuais.map(p => [p.id, p]));
        if (atuais.length !== inv.itens.length) throw new ConflictException('O cadastro de produtos mudou. Cancele e inicie nova contagem.');
        // Não sobrescrever vendas, compras ou alterações ocorridas durante a contagem.
        for (const i of inv.itens) {
          const p = mapa.get(i.produtoId);
          if (!p || p.estoqueAtual !== i.saldoInicial || p.atualizadoEm.getTime() !== i.produtoAtualizadoEm.getTime())
            throw new ConflictException('Produto alterado durante o inventário: ' + i.nome + '. Cancele e refaça a contagem.');
          if (i.contagem !== i.saldoInicial && p._count.lotes > 0)
            throw new BadRequestException('Divergência em produto com lotes: ' + i.nome + '. Requer conferência por lote; nenhum ajuste foi aplicado.');
        }
        // Todas as divergências são aplicadas atomicamente ou nenhuma é aplicada.
        for (const i of inv.itens) {
          const delta = i.contagem! - i.saldoInicial;
          if (!delta) continue;
          const r = await tx.produto.updateMany({ where: { id: i.produtoId, empresaId, ativo: true, estoqueAtual: i.saldoInicial, atualizadoEm: i.produtoAtualizadoEm },
            data: { estoqueAtual: i.contagem! } });
          if (r.count !== 1) throw new ConflictException('Saldo alterado durante o fechamento.');
          await tx.movimentacaoEstoque.create({ data: { empresaId, produtoId: i.produtoId, tipo: delta > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA',
            quantidade: Math.abs(delta), motivo: 'Inventário ' + id + ' — ' + motivo, observacao: 'Aprovado por funcionário ' + funcionarioId } });
        }
      }
      await tx.inventarioEstoque.update({ where: { id }, data: { status: cancelar ? 'CANCELADO' : 'FECHADO', encerradoPorId: funcionarioId, encerradoEm: new Date(), motivoEncerramento: motivo } });
      return this.buscar(tx, empresaId, id);
    });
  }
}
