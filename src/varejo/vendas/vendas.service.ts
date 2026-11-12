import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import {
  FormaPagamento,
  StatusCaixa,
  StatusVenda,
  StatusAcerto,
  TipoTransacaoFiado,
  TipoEntrega,
} from '@prisma/client';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createVendaDto: CreateVendaDto) {
    // A disabled delivery module cannot be bypassed by submitting DELIVERY via PDV.
    if (createVendaDto.tipoEntrega === TipoEntrega.DELIVERY) {
      const module = await this.prisma.empresaModulo.findUnique({
        where: { empresaId_modulo: { empresaId, modulo: 'ENTREGAS_DELIVERY' } },
        select: { ativo: true },
      });
      if (module && !module.ativo) {
        throw new ForbiddenException('Módulo de entregas desativado para esta distribuidora.');
      }
    }
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: createVendaDto.caixaId },
      include: { operador: true },
    });

    if (!caixa || caixa.empresaId !== empresaId) {
      throw new NotFoundException('Caixa informado não foi encontrado nesta empresa.');
    }

    if (caixa.operadorId !== createVendaDto.funcionarioId) {
      throw new BadRequestException('O caixa informado pertence a outro funcionário.');
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

    if (createVendaDto.clienteId) {
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: createVendaDto.clienteId, empresaId, ativo: true },
      });
      if (!cliente) throw new NotFoundException('Cliente não pertence a esta empresa ou está inativo.');
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

    const valorFiado = createVendaDto.pagamentos
      .filter(p => p.formaPagamento === FormaPagamento.FIADO)
      .reduce((total, p) => total + Number(p.valor), 0);

    if (valorFiado > 0) {
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

    if (valorTotal < 0) {
      throw new BadRequestException('O valor total da venda não pode ser negativo.');
    }
    const totalPago = createVendaDto.pagamentos.reduce(
      (sum, p) => sum + Number(p.valor) - Number(p.troco || 0), 0,
    );
    if (Math.abs(totalPago - valorTotal) > 0.009) {
      throw new BadRequestException('A soma dos pagamentos, descontando o troco, deve ser igual ao total da venda.');
    }
    if (createVendaDto.pagamentos.some(p => Number(p.troco || 0) > 0 && p.formaPagamento !== FormaPagamento.DINHEIRO)) {
      throw new BadRequestException('Troco somente é permitido em pagamentos em dinheiro.');
    }

    const statusAcerto = createVendaDto.tipoEntrega === 'DELIVERY'
      ? StatusAcerto.PENDENTE
      : StatusAcerto.CONCLUIDO;

    return this.prisma.$transaction(async (tx) => {
      // Serializa venda e fechamento por caixa, inclusive em requisições concorrentes.
      const caixaTravado = await tx.caixa.updateMany({
        where: { id: createVendaDto.caixaId, empresaId, status: StatusCaixa.ABERTO },
        data: { status: StatusCaixa.ABERTO },
      });
      if (caixaTravado.count !== 1) {
        throw new BadRequestException('Caixa fechado antes da conclusão da venda.');
      }

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
            unidadesEstoque: unidadesParaAbater,
            precoUnitario: item.precoUnitario,
            precoTotal: item.quantidade * Number(item.precoUnitario),
          },
        });

        const baixa = await tx.produto.updateMany({
          where: { id: item.produtoId, empresaId, ativo: true, estoqueAtual: { gte: unidadesParaAbater } },
          data: { estoqueAtual: { decrement: unidadesParaAbater } },
        });
        if (baixa.count !== 1) {
          throw new BadRequestException('Estoque insuficiente ou produto indisponível durante a finalização da venda.');
        }
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

      if (valorFiado > 0 && createVendaDto.clienteId) {
        const clienteAtual = await tx.cliente.findFirst({
          where: { id: createVendaDto.clienteId, empresaId, ativo: true },
        });
        if (!clienteAtual) throw new NotFoundException('Cliente indisponível.');
        const novoSaldo = Number(clienteAtual.saldoDevedor) + valorFiado;
        const limite = Number(clienteAtual.limiteCredito);
        if (limite > 0 && novoSaldo > limite) {
          throw new BadRequestException('Limite do fiado excedido durante a conclusão da venda.');
        }
        const atualizacao = await tx.cliente.updateMany({
          where: {
            id: createVendaDto.clienteId,
            empresaId,
            ativo: true,
            saldoDevedor: { equals: clienteAtual.saldoDevedor },
          },
          data: { saldoDevedor: { increment: valorFiado } },
        });
        if (atualizacao.count !== 1) {
          throw new BadRequestException('Saldo do cliente alterado. Tente novamente.');
        }

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

  async confirmarAcertoDelivery(empresaId: number, vendaIds: string[]) {
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

  async findOne(empresaId: number, id: string) {
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

  async cancelarVenda(empresaId: number, id: string) {
    const venda = await this.findOne(empresaId, id);

    if (venda.status === StatusVenda.CANCELADA) {
      throw new BadRequestException('Esta venda já se encontra CANCELADA.');
    }

    return this.prisma.$transaction(async (tx) => {
      const caixaTravado = await tx.caixa.updateMany({
        where: { id: venda.caixaId, empresaId, status: StatusCaixa.ABERTO },
        data: { status: StatusCaixa.ABERTO },
      });
      if (caixaTravado.count !== 1) {
        throw new BadRequestException('Cancelamento de vendas de caixa fechado exige estorno financeiro separado.');
      }
      const bloqueio = await tx.venda.updateMany({
        where: { id, empresaId, status: StatusVenda.CONCLUIDA },
        data: { status: StatusVenda.CANCELADA },
      });
      if (bloqueio.count !== 1) {
        throw new BadRequestException('Esta venda já foi cancelada ou não pode ser cancelada.');
      }
      let totalCascosParaEstornar = 0;

      // 1. Devolve os produtos ao estoque e contabiliza cascos retornáveis
      for (const item of venda.itens) {
        const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });

        const unidades = item.unidadesEstoque ?? item.quantidade;

        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: {
              increment: unidades,
            },
          },
        });

        if (produto?.retornavel) {
          totalCascosParaEstornar += unidades;
        }
      }

      // 2. Estorno do saldo de cascos em posse do cliente (se houver cliente vinculado)
      if (venda.clienteId && totalCascosParaEstornar > 0) {
        await tx.cliente.update({
          where: { id: venda.clienteId },
          data: {
            cascosEmPosse: {
              decrement: totalCascosParaEstornar,
            },
          },
        });
      }

      // 3. Estorno do Fiado (se houver pagamento em FIADO)
      const valorFiadoCancelado = venda.pagamentos
        .filter(p => p.formaPagamento === FormaPagamento.FIADO)
        .reduce((total, p) => total + Number(p.valor), 0);

      if (valorFiadoCancelado > 0 && venda.clienteId) {
        const valorFiado = valorFiadoCancelado;
        const clienteAtual = await tx.cliente.findUnique({
          where: { id: venda.clienteId },
        });

        if (Number(clienteAtual.saldoDevedor) < valorFiado) {
          throw new BadRequestException('Fiado já amortizado: concilie o pagamento antes de cancelar esta venda.');
        }
        const novoSaldo = Number(clienteAtual.saldoDevedor) - valorFiado;

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

      // 4. Marca a venda como CANCELADA
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