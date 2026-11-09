import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * Comprovante comercial interno. Não é documento fiscal, DANFE ou NFC-e.
 * O cliente frontend pode imprimi-lo em impressora térmica usando os dados JSON.
 */
@Injectable()
export class ComprovanteService {
  constructor(private readonly prisma: PrismaService) {}

  async obter(empresaId: number, vendaId: string) {
    const [venda, empresa] = await Promise.all([
      this.prisma.venda.findFirst({
        where: { id: vendaId, empresaId },
        include: {
          itens: { include: { produto: { select: { nome: true, unidadeMedida: true } } } },
          pagamentos: true,
          cliente: { select: { nome: true } },
          funcionario: { select: { nome: true } },
        },
      }),
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: {
          nomeFantasia: true,
          config: { select: { telefone: true, endereco: true } },
        },
      }),
    ]);
    if (!venda || !empresa) {
      throw new NotFoundException('Venda ou empresa não encontrada.');
    }

    return {
      tipo: 'COMPROVANTE_NAO_FISCAL' as const,
      titulo: 'COMPROVANTE NÃO FISCAL',
      aviso: 'Documento interno sem valor fiscal. Não substitui NFC-e ou NF-e.',
      loja: {
        nome: empresa.nomeFantasia,
        telefone: empresa.config?.telefone ?? null,
        endereco: empresa.config?.endereco ?? null,
      },
      venda: {
        id: venda.id,
        numero: venda.codigoVenda,
        realizadaEm: venda.criadoEm.toISOString(),
        status: venda.status,
        operador: venda.funcionario.nome,
        cliente: venda.cliente?.nome ?? null,
      },
      itens: venda.itens.map(item => ({
        descricao: item.produto.nome,
        unidade: item.produto.unidadeMedida,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        total: Number(item.precoTotal),
      })),
      valores: {
        subtotal: Number(venda.subtotal),
        desconto: Number(venda.desconto),
        taxaEntrega: Number(venda.taxaEntrega),
        total: Number(venda.valorTotal),
      },
      pagamentos: venda.pagamentos.map(pagamento => ({
        forma: pagamento.formaPagamento,
        valor: Number(pagamento.valor),
        troco: Number(pagamento.troco),
      })),
    };
  }
}
