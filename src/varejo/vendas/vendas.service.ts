import { exigirCredito } from '../clientes/credito';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { consultarModulos } from '../../common/modulos/plano-modulos';
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
    // The same entitlement resolver also protects optional actions inside the PDV.
    const modulos = await consultarModulos(this.prisma, empresaId);
    if (!modulos.ENTREGAS_DELIVERY && (createVendaDto.tipoEntrega === TipoEntrega.DELIVERY || Number(createVendaDto.taxaEntrega || 0) > 0)) {
      throw new ForbiddenException('Módulo de entregas desativado.');
    }
    if (!modulos.FIADOS && createVendaDto.pagamentos.some(p => p.formaPagamento === FormaPagamento.FIADO)) {
      throw new ForbiddenException('Módulo de fiados desativado.');
    }
    if (!modulos.VASILHAMES_RETORNAVEIS && Number(createVendaDto.cascosDevolvidos || 0) > 0) {
      throw new ForbiddenException('Módulo de vasilhames desativado.');
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

    if(!modulos.CAIXA_PDV)throw new ForbiddenException('Módulo de PDV desativado.');
    if(createVendaDto.tipoEntrega===TipoEntrega.DELIVERY&&!createVendaDto.enderecoEntrega?.trim())throw new BadRequestException('Informe o endereço da entrega.');
    if(createVendaDto.tipoEntrega!==TipoEntrega.DELIVERY&&Number(createVendaDto.taxaEntrega||0)>0)throw new BadRequestException('Taxa de entrega exige delivery.');
    if(Number(createVendaDto.cascosDevolvidos||0)>0&&!createVendaDto.clienteId)throw new BadRequestException('Informe o cliente para devolver vasilhames.');
    if(createVendaDto.pagamentos.some(p=>Number(p.troco||0)>Number(p.valor)))throw new BadRequestException('Troco não pode superar o pagamento.');
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

      if (modulos.VASILHAMES_RETORNAVEIS && produto.retornavel) {
        totalCascosNovos += unidadesParaAbater;
      }

      if(!Number.isInteger(item.quantidade)||item.quantidade<1)throw new BadRequestException('Quantidade inválida.');
      if(item.isFardo&&Number(produto.fardoQuantidade||1)<2)throw new BadRequestException('Produto sem fardo cadastrado.');
      const preco=Number(item.isFardo&&produto.precoVendaAtacado!=null?produto.precoVendaAtacado:produto.precoVendaVarejo);
      if(Math.abs(preco-Number(item.precoUnitario))>0.0001)throw new BadRequestException('Preço do produto alterado. Atualize o PDV antes de finalizar.');
      subtotal += item.quantidade * preco;
    }

    const desconto = Number(createVendaDto.desconto || 0);
    const taxaEntrega = Number(createVendaDto.taxaEntrega || 0);
    if(desconto>subtotal)throw new BadRequestException('Desconto não pode superar o subtotal.');
    const gestor=['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(funcionario.cargo);
    if(!gestor&&desconto>subtotal*Number(funcionario.descontoMaximo)/100+0.0001)throw new ForbiddenException('Desconto supera o limite autorizado para este funcionário.');
    const valorTotal = Math.round((subtotal - desconto + taxaEntrega)*100)/100;

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

      exigirCredito(cliente, valorFiado);
    }

    if (valorTotal <= 0) {
      throw new BadRequestException('O valor total da venda deve ser positivo.');
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

      // Recheck and lock the customer in the transaction to serialize with inactivation.
      if (createVendaDto.clienteId) {
        const clienteAtivo = await tx.cliente.updateMany({
          where: { id: createVendaDto.clienteId, empresaId, ativo: true },
          data: { ativo: true },
        });
        if (clienteAtivo.count !== 1) throw new BadRequestException('Cliente inativo ou indisponível.');
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
        const produto = await tx.produto.findFirst({where:{id:item.produtoId,empresaId,ativo:true}});
        if(!produto)throw new BadRequestException('Produto indisponível.');
        const precoAtual=Number(item.isFardo&&produto.precoVendaAtacado!=null?produto.precoVendaAtacado:produto.precoVendaVarejo);
        if(Math.abs(precoAtual-Number(item.precoUnitario))>0.0001)throw new BadRequestException('Preço alterado durante a venda. Atualize o PDV.');
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

        const alteracao=await tx.cliente.updateMany({
          where:{id:createVendaDto.clienteId,empresaId,ativo:true,...(variacaoCascos<0?{cascosEmPosse:{gte:-variacaoCascos}}:{})},
          data:{cascosEmPosse:{increment:variacaoCascos}},
        });
        if(alteracao.count!==1)throw new BadRequestException('Saldo insuficiente de vasilhames ou cliente indisponível.');
      }

      if (valorFiado > 0 && createVendaDto.clienteId) {
        const clienteAtual = await tx.cliente.findFirst({
          where: { id: createVendaDto.clienteId, empresaId, ativo: true },
        });
        if (!clienteAtual) throw new NotFoundException('Cliente indisponível.');
        const novoSaldo = Number(clienteAtual.saldoDevedor) + valorFiado;
        exigirCredito(clienteAtual, valorFiado);
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
    if(!Array.isArray(vendaIds)||vendaIds.length<1||vendaIds.length>200||vendaIds.some(id=>typeof id!=='string'||!id.trim()))throw new BadRequestException('Informe de 1 a 200 vendas válidas.');
    const ids=[...new Set(vendaIds)];
    return this.prisma.$transaction(async tx=>{
      const vendas=await tx.venda.findMany({where:{id:{in:ids},empresaId,tipoEntrega:TipoEntrega.DELIVERY,status:StatusVenda.CONCLUIDA,statusAcerto:StatusAcerto.PENDENTE},select:{id:true,caixaId:true}});
      if(vendas.length!==ids.length)throw new BadRequestException('Há vendas inválidas ou já acertadas na seleção.');
      for(const caixaId of [...new Set(vendas.map(v=>v.caixaId))].sort()){
        const lock=await tx.caixa.updateMany({where:{id:caixaId,empresaId,status:StatusCaixa.ABERTO},data:{status:StatusCaixa.ABERTO}});
        if(lock.count!==1)throw new BadRequestException('Entrega vinculada a caixa fechado exige conciliação separada.');
      }
      const resultado=await tx.venda.updateMany({where:{id:{in:ids},empresaId,tipoEntrega:TipoEntrega.DELIVERY,status:StatusVenda.CONCLUIDA,statusAcerto:StatusAcerto.PENDENTE},data:{statusAcerto:StatusAcerto.CONCLUIDO}});
      if(resultado.count!==ids.length)throw new BadRequestException('Acerto alterado durante a operação. Atualize a lista.');
      return resultado;
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

        const estorno=await tx.cliente.updateMany({
          where:{id:venda.clienteId,empresaId,saldoDevedor:{equals:clienteAtual.saldoDevedor}},
          data:{saldoDevedor:{decrement:valorFiado}},
        });
        if(estorno.count!==1)throw new BadRequestException('Saldo do fiado alterado durante o estorno. Tente novamente.');

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