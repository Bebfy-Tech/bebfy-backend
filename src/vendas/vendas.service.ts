// Importamos os decoradores e exceções padrão do NestJS
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// Importamos o PrismaService e os Enums de regras de negócio
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import {
  FormaPagamento,
  StatusCaixa,
  StatusVenda,
  TipoTransacaoFiado,
} from '@prisma/client';

@Injectable()
export class VendasService {
  constructor(private readonly prisma: PrismaService) {}

  // Processa uma nova venda completa com transação atômica no banco de dados
  async create(createVendaDto: CreateVendaDto) {
    // 1. Valida se o Caixa informado existe e se está ABERTO
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: createVendaDto.caixaId },
    });

    if (!caixa) {
      throw new NotFoundException('Caixa informado não foi encontrado.');
    }

    if (caixa.status !== StatusCaixa.ABERTO) {
      throw new BadRequestException('Não é possível realizar vendas em um caixa FECHADO.');
    }

    // 2. Valida o Funcionário
    const funcionario = await this.prisma.funcionario.findUnique({
      where: { id: createVendaDto.funcionarioId },
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado.');
    }

    // 3. Valida os Produtos e o Estoque disponível
    let subtotal = 0;
    for (const item of createVendaDto.itens) {
      const produto = await this.prisma.produto.findUnique({
        where: { id: item.produtoId },
      });

      if (!produto) {
        throw new NotFoundException(`Produto ID ${item.produtoId} não encontrado.`);
      }

      if (produto.estoqueAtual < item.quantidade) {
        throw new BadRequestException(
          `Estoque insuficiente para o produto "${produto.nome}". Disponível: ${produto.estoqueAtual}, Solicitado: ${item.quantidade}`,
        );
      }

      subtotal += item.quantidade * Number(item.precoUnitario);
    }

    // 4. Calcula o Valor Total da Venda
    const desconto = Number(createVendaDto.desconto || 0);
    const taxaEntrega = Number(createVendaDto.taxaEntrega || 0);
    const valorTotal = subtotal - desconto + taxaEntrega;

    // 5. Verifica se há pagamento na modalidade FIADO e realiza as validações de cliente e limite
    const pagamentoFiado = createVendaDto.pagamentos.find(
      (p) => p.formaPagamento === FormaPagamento.FIADO,
    );

    if (pagamentoFiado) {
      if (!createVendaDto.clienteId) {
        throw new BadRequestException(
          'É obrigatório informar o cliente para vendas com pagamento no FIADO.',
        );
      }

      const cliente = await this.prisma.cliente.findUnique({
        where: { id: createVendaDto.clienteId },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente informado para a venda não foi encontrado.');
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

    // 6. Executa a gravação da Venda, Itens, Pagamentos, Baixa no Estoque e Fiado dentro de uma transação
    return this.prisma.$transaction(async (tx) => {
      // 6.1 Cria o registro principal da Venda
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
        },
      });

      // 6.2 Registra os Itens da Venda e dá Baixa no Estoque dos Produtos
      for (const item of createVendaDto.itens) {
        await tx.itemVenda.create({
          data: {
            vendaId: venda.id,
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            precoTotal: item.quantidade * Number(item.precoUnitario),
          },
        });

        // Abate do estoque do produto
        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: {
              decrement: item.quantidade,
            },
          },
        });
      }

      // 6.3 Registra os Pagamentos da Venda
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

      // 6.4 Se houver fiado, atualiza o saldo do cliente e cria o histórico de débito
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

      // Retorna a venda completa com seus relacionamentos
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

  // Lista todas as vendas realizadas
  async findAll() {
    return this.prisma.venda.findMany({
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        cliente: true,
        funcionario: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Busca uma venda específica pelo ID
  async findOne(id: string) {
    const venda = await this.prisma.venda.findUnique({
      where: { id },
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        cliente: true,
        funcionario: true,
        caixa: true,
      },
    });

    if (!venda) {
      throw new NotFoundException(`Venda com o ID ${id} não foi encontrada.`);
    }

    return venda;
  }

  // Cancela uma venda e estorna o estoque dos produtos
  async cancelarVenda(id: string) {
    const venda = await this.findOne(id);

    if (venda.status === StatusVenda.CANCELADA) {
      throw new BadRequestException('Esta venda já se encontra CANCELADA.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Reverte o estoque dos produtos
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

      // Atualiza o status da venda para CANCELADA
      return tx.venda.update({
        where: { id },
        data: { status: StatusVenda.CANCELADA },
      });
    });
  }
}