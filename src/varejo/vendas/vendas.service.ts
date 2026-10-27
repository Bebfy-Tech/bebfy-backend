// Importamos os decoradores e exceções padrão do NestJS
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// Importamos o PrismaService e os Enums de regras de negócio
import { PrismaService } from '../../core/prisma/prisma.service';
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

  // Processa uma nova venda completa com transação atômica no banco de dados e suporte Multi-tenant
  async create(createVendaDto: CreateVendaDto, empresaId: number = 1) {
    // 1. Valida se o Caixa informado existe e se está ABERTO
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: createVendaDto.caixaId },
      include: { operador: true },
    });

    if (!caixa) {
      throw new NotFoundException('Caixa informado não foi encontrado.');
    }

    if (caixa.status !== StatusCaixa.ABERTO) {
      throw new BadRequestException('Não é possível realizar vendas em um caixa FECHADO.');
    }

    // 2. Valida o Funcionário dentro da mesma empresa
    const funcionario = await this.prisma.funcionario.findFirst({
      where: { id: createVendaDto.funcionarioId, empresaId },
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionário não encontrado nesta empresa.');
    }

    // 3. Valida os Produtos e o Estoque disponível na empresa
    let subtotal = 0;
    for (const item of createVendaDto.itens) {
      const produto = await this.prisma.produto.findFirst({
        where: { id: item.produtoId, empresaId },
      });

      if (!produto) {
        throw new NotFoundException(`Produto ID ${item.produtoId} não encontrado nesta empresa.`);
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

      const cliente = await this.prisma.cliente.findFirst({
        where: { id: createVendaDto.clienteId, empresaId } as any,
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

    // 6. Executa a gravação da Venda, Itens, Pagamentos, Baixa no Estoque e Fiado dentro de uma transação
    return this.prisma.$transaction(async (tx) => {
      // 6.1 Cria o registro principal da Venda associado à Empresa
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
          empresaId,
        } as any,
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

  // Lista todas as vendas realizadas na empresa
  async findAll(empresaId: number = 1) {
    return this.prisma.venda.findMany({
      where: { empresaId } as any,
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        cliente: true,
        funcionario: true,
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  // Busca uma venda específica pelo ID garantindo isolamento de tenant
  async findOne(id: string, empresaId: number = 1) {
    const venda = await this.prisma.venda.findFirst({
      where: { id, empresaId } as any,
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

  // Cancela uma venda, estorna o estoque dos produtos e reverte débitos no Fiado (se houver)
  async cancelarVenda(id: string, empresaId: number = 1) {
    const venda = await this.findOne(id, empresaId);

    if (venda.status === StatusVenda.CANCELADA) {
      throw new BadRequestException('Esta venda já se encontra CANCELADA.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Estorna/Devolve a quantidade dos produtos ao estoque
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

      // 2. Se a venda teve pagamento no FIADO, estorna o débito da conta do cliente
      const pagamentoFiado = venda.pagamentos.find(
        (p) => p.formaPagamento === FormaPagamento.FIADO,
      );

      if (pagamentoFiado && venda.clienteId) {
        const valorFiado = Number(pagamentoFiado.valor);

        const clienteAtual = await tx.cliente.findUnique({
          where: { id: venda.clienteId },
        });

        const novoSaldo = Math.max(0, Number(clienteAtual.saldoDevedor) - valorFiado);

        // Subtrai o valor do saldo devedor do cliente
        await tx.cliente.update({
          where: { id: venda.clienteId },
          data: { saldoDevedor: novoSaldo },
        });

        // Registra o estorno no Histórico do Fiado
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

      // 3. Atualiza o status da venda para CANCELADA
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