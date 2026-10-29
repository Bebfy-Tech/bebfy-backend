import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import {
  FormaPagamento,
  StatusCaixa,
  StatusVenda,
  StatusAcerto,
  TipoTransacaoFiado,
} from '@prisma/client';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createVendaDto: CreateVendaDto, empresaId: number) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: createVendaDto.caixaId },
      include: { operador: true },
    });

    if (!caixa || caixa.empresaId !== empresaId) {
      throw new NotFoundException('Caixa informado não foi encontrado nesta empresa.');
    }

    if (caixa.status !== StatusCaixa.ABERTO) {
      throw new BadRequestException('Não é possível realizar vendas em um caixa FECHADO.');
    }

    const funcionario = await this.prisma.funcionario.findFirst({
      where: { id: createVendaDto.funcionarioId, empresaId, ativo: true },
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado nesta empresa.');
    }

    let subtotal = 0;
    let totalCascosNovos = 0;

    for (const item of createVendaDto.itens) {
      const produto = await this.prisma.produto.findFirst({
        where: { id: item.produtoId, empresaId, ativo: true },
      });

      if (!produto) {
        throw new NotFoundException(`Produto ID ${item.produtoId} não encontrado nesta empresa.`);
      }

      const unidadesParaAbater = item.isFardo
        ? item.quantidade * (produto.fardoQuantidade || 1)
        : item.quantidade;

      if (produto.estoqueAtual < unidadesParaAbater) {
        throw new BadRequestException(
          `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoqueAtual}, Solicitado: ${unidadesParaAbater}`,
        );
      }

      if (produto.retornavel) {
        totalCascosNovos += unidadesParaAbater;
      }

      subtotal += item.quantidade * Number(item.precoUnitario);
    }

    const desconto = Number(createVendaDto.desconto || 0);
    const taxaEntrega = Number(createVendaDto.taxaEntrega || 0);
    const valorTotal = subtotal - desconto + taxaEntrega;

    const pagamentoFiado = createVendaDto.pagamentos.find(
      (p) => p.formaPagamento === FormaPagamento.FIADO,
    );

    if (pagamentoFiado) {
      if (!createVendaDto.clienteId) {
        throw new BadRequestException(
          'É obrigatório informar o cliente para vendas com pagamento no FIADO.',
        );
      }

      const cliente = await this.prisma.cliente.findFirst({
        where: { id: createVendaDto.clienteId, empresaId, ativo: true },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente informado para a venda não foi encontrado nesta empresa.');
      }

      const valorFiado = Number(pagamentoFiado.valor);
      const saldoProjetado = Number(cliente.saldoDevedor) + valorFiado;
      const limiteCredito = Number(cliente.limiteCredito);

      if (limiteCredito > 0 && saldoProjetado > limiteCredito) {
        throw new BadRequestException(
          `Venda bloqueada: O valor no fiado ultrapassará o limite de crédito do cliente (Limite: R$ ${limiteCredito.toFixed(
            2,
          )}, Saldo Atual: R$ ${Number(cliente.saldoDevedor).toFixed(2)}).`,
        );
      }
    }

    const statusAcerto = createVendaDto.tipoEntrega === 'DELIVERY'
      ? StatusAcerto.PENDENTE
      : StatusAcerto.CONCLUIDO;

    return this.prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          caixaId: createVendaDto.caixaId,
          funcionarioId: createVendaDto.funcionarioId,
          clienteId: createVendaDto.clienteId,
          subtotal,
          desconto,
          valorTotal,
          taxaEntrega,
          enderecoEntrega: createVendaDto.enderecoEntrega,
          tipoEntrega: createVendaDto.tipoEntrega || 'RETIRADA_BALCAO',
          status: StatusVenda.CONCLUIDA,
          statusAcerto,
          empresaId,
        },
      });

      for (const item of createVendaDto.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });
        const unidadesParaAbater = item.isFardo
          ? item.quantidade * (produto.fardoQuantidade || 1)
          : item.quantidade;

        await tx.itemVenda.create({
          data: {
            vendaId: venda.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            precoTotal: item.quantidade * Number(item.precoUnitario),
          },
        });

        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: {
              decrement: unidadesParaAbater,
            },
          },
        });
      }

      for (const pag of createVendaDto.pagamentos) {
        await tx.pagamentoVenda.create({
          data: {
            vendaId: venda.id,
            formaPagamento: pag.formaPagamento,
            valor: pag.valor,
            troco: pag.troco || 0,
          },
        });
      }

      if (createVendaDto.clienteId && (totalCascosNovos > 0 || createVendaDto.cascosDevolvidos)) {
        const cascosDevolvidos = createVendaDto.cascosDevolvidos || 0;
        const variacaoCascos = totalCascosNovos - cascosDevolvidos;

        await tx.cliente.update({
          where: { id: createVendaDto.clienteId },
          data: {
            cascosEmPosse: {
              increment: variacaoCascos,
            },
          },
        });
      }

      if (pagamentoFiado && createVendaDto.clienteId) {
        const valorFiado = Number(pagamentoFiado.valor);
        const clienteAtual = await tx.cliente.findUnique({
          where: { id: createVendaDto.clienteId },
        });

        const novoSaldo = Number(clienteAtual.saldoDevedor) + valorFiado;

        await tx.cliente.update({
          where: { id: createVendaDto.clienteId },
          data: { saldoDevedor: novoSaldo },
        });

        await tx.historicoFiado.create({
          data: {
            clienteId: createVendaDto.clienteId,
            vendaId: venda.id,
            tipo: TipoTransacaoFiado.DEBITO,
            valor: valorFiado,
            descricao: `Venda no PDV código #${venda.codigoVenda}`,
            saldoApos: novoSaldo,
          },
        });
      }

      return tx.venda.findUnique({
        where: { id: venda.id },
        include: {
          itens: { include: { produto: true } },
          pagamentos: true,
          cliente: true,
          funcionario: true,
        },
      });
    });
  }

  async listarPendentesAcertoDelivery(empresaId: number) {
    const vendas = await this.prisma.venda.findMany({
      where: {
        empresaId,
        tipoEntrega: 'DELIVERY',
        statusAcerto: StatusAcerto.PENDENTE,
        status: StatusVenda.CONCLUIDA,
      },
      include: {
        cliente: true,
        funcionario: true,
        pagamentos: true,
      },
      orderBy: { criadoEm: 'desc' },
    });

    const totalPendentes = vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0);

    return {
      quantidade: vendas.length,
      totalPendentes,
      vendas,
    };
  }

  async confirmarAcertoDelivery(vendaIds: string[], empresaId: number) {
    return this.prisma.venda.updateMany({
      where: {
        id: { in: vendaIds },
        empresaId,
      },
      data: {
        statusAcerto: StatusAcerto.CONCLUIDO,
      },
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.venda.findMany({
      where: { empresaId },
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        cliente: true,
        funcionario: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, empresaId: number) {
    const venda = await this.prisma.venda.findFirst({
      where: { id, empresaId },
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        cliente: true,
        funcionario: true,
        caixa: true,
      },
    });

    if (!venda) {
      throw new NotFoundException(`Venda com o ID ${id} não foi encontrada nesta empresa.`);
    }

    return venda;
  }

  async cancelarVenda(id: string, empresaId: number) {
    const venda = await this.findOne(id, empresaId);

    if (venda.status === StatusVenda.CANCELADA) {
      throw new BadRequestException('Esta venda já se encontra CANCELADA.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of venda.itens) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: {
              increment: item.quantidade,
            },
          },
        });
      }

      const pagamentoFiado = venda.pagamentos.find(
        (p) => p.formaPagamento === FormaPagamento.FIADO,
      );

      if (pagamentoFiado && venda.clienteId) {
        const valorFiado = Number(pagamentoFiado.valor);
        const clienteAtual = await tx.cliente.findUnique({
          where: { id: venda.clienteId },
        });

        const novoSaldo = Math.max(0, Number(clienteAtual.saldoDevedor) - valorFiado);

        await tx.cliente.update({
          where: { id: venda.clienteId },
          data: { saldoDevedor: novoSaldo },
        });

        await tx.historicoFiado.create({
          data: {
            clienteId: venda.clienteId,
            vendaId: venda.id,
            tipo: TipoTransacaoFiado.CREDITO,
            valor: valorFiado,
            descricao: `Estorno/Cancelamento da venda código #${venda.codigoVenda}`,
            saldoApos: novoSaldo,
          },
        });
      }

      return tx.venda.update({
        where: { id },
        data: { status: StatusVenda.CANCELADA },
        include: {
          itens: true,
          pagamentos: true,
          cliente: true,
        },
      });
    });
  }
}