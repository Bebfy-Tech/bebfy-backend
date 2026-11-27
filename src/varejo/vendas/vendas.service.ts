import { formasOperacionais, resolverPagamento } from '../../financeiro/pagamentos-operacionais';
import { AtualizarEntregaDto } from './dto/delivery.dto';
import { validarTransicaoEntrega, resumoDelivery } from './delivery-regras';
import { aplicarCasco } from '../../produtos/vasilhames/saldos';
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

  async formasPagamento(empresaId:number){
    const modulos=await consultarModulos(this.prisma,empresaId);
    const formas=await this.prisma.$transaction(tx=>formasOperacionais(tx,empresaId,'pdv'));
    return formas.filter(f=>!f.fiado||modulos.FIADOS).map(f=>({id:f.id,nome:f.nome,formaPagamento:f.fiado?'FIADO':f.formaBase,maxParcelas:f.maxParcelas,taxas:f.taxas}));
  }
  async create(empresaId: number, createVendaDto: CreateVendaDto) {
    // The same entitlement resolver also protects optional actions inside the PDV.
    const modulos = await consultarModulos(this.prisma, empresaId);
    if (!modulos.ENTREGAS_DELIVERY && (createVendaDto.tipoEntrega === TipoEntrega.DELIVERY || Number(createVendaDto.taxaEntrega || 0) > 0)) {
      throw new ForbiddenException('Módulo de entregas desativado.');
    }
    if (!modulos.FIADOS && createVendaDto.pagamentos.some(p => p.formaPagamento === FormaPagamento.FIADO)) {
      throw new ForbiddenException('Módulo de fiados desativado.');
    }
    const devolucoes=createVendaDto.devolucoesCascos??[];
    if(devolucoes.length&&Number(createVendaDto.cascosDevolvidos||0)>0)throw new BadRequestException('Informe devoluções por tipo ou saldo antigo, não ambos os formatos.');
    if (!modulos.VASILHAMES_RETORNAVEIS && (Number(createVendaDto.cascosDevolvidos || 0) > 0||devolucoes.length)) {
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
    if((Number(createVendaDto.cascosDevolvidos||0)>0||devolucoes.length)&&!createVendaDto.clienteId)throw new BadRequestException('Informe o cliente para devolver vasilhames.');
    if(createVendaDto.pagamentos.some(p=>Number(p.troco||0)>Number(p.valor)))throw new BadRequestException('Troco não pode superar o pagamento.');
    let subtotal = 0;


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
          statusEntrega:createVendaDto.tipoEntrega===TipoEntrega.DELIVERY?'PENDENTE':null,
          vasilhamesControlados:true,
          empresaId,
        },
      });

      if(createVendaDto.tipoEntrega===TipoEntrega.DELIVERY)await tx.eventoEntrega.create({data:{vendaId:venda.id,status:'PENDENTE',operadorId:createVendaDto.funcionarioId}});
      for (const item of createVendaDto.itens) {
        const produto = await tx.produto.findFirst({where:{id:item.produtoId,empresaId,ativo:true}});
        if(!produto)throw new BadRequestException('Produto indisponível.');
        const precoAtual=Number(item.isFardo&&produto.precoVendaAtacado!=null?produto.precoVendaAtacado:produto.precoVendaVarejo);
        if(Math.abs(precoAtual-Number(item.precoUnitario))>0.0001)throw new BadRequestException('Preço alterado durante a venda. Atualize o PDV.');
        const unidadesParaAbater = item.isFardo
          ? item.quantidade * (produto.fardoQuantidade || 1)
          : item.quantidade;

        const itemGravado = await tx.itemVenda.create({
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
          where: { id: item.produtoId, empresaId, ativo: true, estoqueAtual: { gte: unidadesParaAbater }, precoCusto:produto.precoCusto, retornavel:produto.retornavel,tipoVasilhameId:produto.tipoVasilhameId },
          data: { estoqueAtual: { decrement: unidadesParaAbater } },
        });
        if (baixa.count !== 1) {
          throw new BadRequestException('Estoque insuficiente ou produto indisponível durante a finalização da venda.');
        }
        // Custo unitário vigente no momento da baixa; persistido na mesma transação.
        // O produto precisa conservar o custo lido até a atualização condicional acima.
        await tx.itemVendaCusto.create({data:{itemVendaId:itemGravado.id,custoUnitario:produto.precoCusto}});
        if(modulos.VASILHAMES_RETORNAVEIS&&createVendaDto.clienteId&&produto.retornavel){
          if(!produto.tipoVasilhameId)throw new BadRequestException('Associe '+produto.nome+' a um tipo de vasilhame antes da venda.');
          if(!await tx.tipoVasilhame.findFirst({where:{id:produto.tipoVasilhameId,empresaId}}))throw new BadRequestException('Tipo de vasilhame inválido.');
          await aplicarCasco(tx,empresaId,createVendaDto.clienteId,{tipoVasilhameId:produto.tipoVasilhameId,produtoId:produto.id,quantidade:unidadesParaAbater,origem:'VENDA',vendaId:venda.id});
        }
      }

      for (const pag of createVendaDto.pagamentos) {
        const snapshot=await resolverPagamento(tx,empresaId,'pdv',pag.formaPagamento,pag.formaCadastroId,pag.parcelas??1,Math.round((pag.valor-(pag.troco??0))*100)/100);
        await tx.pagamentoVenda.create({
          data: {
            vendaId: venda.id,
            formaPagamento: pag.formaPagamento,
            valor: pag.valor,
            troco: pag.troco || 0,
            ...snapshot,
          },
        });
      }

      if(createVendaDto.clienteId&&modulos.VASILHAMES_RETORNAVEIS){
        const retornos=devolucoes.length?devolucoes:(createVendaDto.cascosDevolvidos?[{tipoVasilhameId:null,quantidade:createVendaDto.cascosDevolvidos}]:[]);
        for(const d of retornos){
          if(d.tipoVasilhameId!=null&&!await tx.tipoVasilhame.findFirst({where:{id:d.tipoVasilhameId,empresaId}}))throw new BadRequestException('Tipo de vasilhame inválido.');
          await aplicarCasco(tx,empresaId,createVendaDto.clienteId,{tipoVasilhameId:d.tipoVasilhameId??null,quantidade:-d.quantidade,origem:'DEVOLUCAO_PDV',vendaId:venda.id});
        }
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
            origem: 'VENDA',
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

  async listarEntregas(empresaId:number){
    const [vendas,entregadores]=await Promise.all([
      this.prisma.venda.findMany({where:{empresaId,tipoEntrega:TipoEntrega.DELIVERY},include:{cliente:{select:{id:true,nome:true,codigoCliente:true,telefone:true}},funcionario:{select:{id:true,nome:true}},entregador:{select:{id:true,nome:true,codigo:true,telefone:true}},pagamentos:true,itens:{include:{produto:{select:{id:true,nome:true}}}},historicoEntrega:{orderBy:{criadoEm:'desc'}}},orderBy:{criadoEm:'desc'}}),
      this.prisma.funcionario.findMany({where:{empresaId,cargo:'ENTREGADOR'},select:{id:true,nome:true,codigo:true,telefone:true,ativo:true},orderBy:{nome:'asc'}}),
    ]);
    return {vendas,entregadores};
  }
  async atualizarEntrega(empresaId:number,id:string,dto:AtualizarEntregaDto,operadorId:string){
    return this.prisma.$transaction(async tx=>{
      const venda=await tx.venda.findFirst({where:{id,empresaId,tipoEntrega:TipoEntrega.DELIVERY,status:StatusVenda.CONCLUIDA}});
      if(!venda)throw new NotFoundException('Entrega não encontrada.');
      if(venda.statusAcerto!==StatusAcerto.PENDENTE)throw new BadRequestException('Entrega já acertada.');
      const entregadorId=dto.entregadorId??venda.entregadorId;
      validarTransicaoEntrega(venda.statusEntrega,dto.status,entregadorId,dto.observacao);
      if(venda.statusEntrega==='SAIU_PARA_ENTREGA'&&dto.entregadorId&&dto.entregadorId!==venda.entregadorId)throw new BadRequestException('Não é possível trocar o entregador durante a confirmação da rota.');
      if(entregadorId&&(dto.entregadorId||dto.status==='SAIU_PARA_ENTREGA')){
        if(!await tx.funcionario.findFirst({where:{id:entregadorId,empresaId,ativo:true,cargo:'ENTREGADOR'}}))throw new BadRequestException('Entregador ativo não encontrado nesta empresa.');
      }
      const r=await tx.venda.updateMany({where:{id,empresaId,status:StatusVenda.CONCLUIDA,statusAcerto:StatusAcerto.PENDENTE,statusEntrega:venda.statusEntrega,entregadorId:venda.entregadorId},data:{statusEntrega:dto.status,entregadorId,...(dto.status==='SAIU_PARA_ENTREGA'?{saidaEntregaEm:new Date()}:{}),...(dto.status==='ENTREGUE'?{entregueEm:venda.statusEntrega===null?null:new Date()}:{} )}});
      if(r.count!==1)throw new BadRequestException('Entrega alterada durante a operação. Atualize.');
      await tx.eventoEntrega.create({data:{vendaId:id,status:dto.status,entregadorId,operadorId,observacao:dto.observacao?.trim()||null}});
      return {ok:true};
    });
  }
  async listarPendentesAcertoDelivery(empresaId:number){
    const vendas=await this.prisma.venda.findMany({where:{empresaId,tipoEntrega:TipoEntrega.DELIVERY,statusAcerto:StatusAcerto.PENDENTE,status:StatusVenda.CONCLUIDA},include:{cliente:true,funcionario:true,entregador:true,pagamentos:true},orderBy:{criadoEm:'desc'}});
    const formas=resumoDelivery(vendas.flatMap(v=>v.pagamentos));
    return {quantidade:vendas.length,totalPendentes:(formas.DINHEIRO+formas.PIX+formas.CARTAO_CREDITO+formas.CARTAO_DEBITO)/100,dinheiroPendente:formas.DINHEIRO/100,vendas};
  }
  async confirmarAcertoDelivery(empresaId:number,vendaIds:string[],dinheiroConferido:number,operadorId:string){
    if(!Array.isArray(vendaIds)||vendaIds.length<1||vendaIds.length>200||vendaIds.some(id=>typeof id!=='string'||!id.trim()))throw new BadRequestException('Informe de 1 a 200 vendas válidas.');
    const ids=[...new Set(vendaIds)];
    return this.prisma.$transaction(async tx=>{
      const vendas=await tx.venda.findMany({where:{id:{in:ids},empresaId,tipoEntrega:TipoEntrega.DELIVERY,status:StatusVenda.CONCLUIDA,statusAcerto:StatusAcerto.PENDENTE,statusEntrega:'ENTREGUE'},include:{pagamentos:true}});
      if(vendas.length!==ids.length)throw new BadRequestException('Selecione apenas entregas concluídas e pendentes de acerto.');
      if(vendas.some(v=>!v.entregadorId)||new Set(vendas.map(v=>v.entregadorId)).size!==1)throw new BadRequestException('Selecione entregas de um mesmo entregador.');
      const formas=resumoDelivery(vendas.flatMap(v=>v.pagamentos));
      if(!Number.isFinite(dinheiroConferido)||Math.round(dinheiroConferido*100)!==formas.DINHEIRO)throw new BadRequestException('Dinheiro conferido difere do esperado. Concilie antes de confirmar.');
      for(const caixaId of [...new Set(vendas.map(v=>v.caixaId))].sort()){
        const lock=await tx.caixa.updateMany({where:{id:caixaId,empresaId,status:StatusCaixa.ABERTO},data:{status:StatusCaixa.ABERTO}});
        if(lock.count!==1)throw new BadRequestException('Entrega vinculada a caixa fechado exige conciliação separada.');
      }
      const resultado=await tx.venda.updateMany({where:{id:{in:ids},empresaId,tipoEntrega:TipoEntrega.DELIVERY,status:StatusVenda.CONCLUIDA,statusAcerto:StatusAcerto.PENDENTE,statusEntrega:'ENTREGUE',entregadorId:vendas[0].entregadorId},data:{statusAcerto:StatusAcerto.CONCLUIDO,acertoEm:new Date(),acertoOperadorId:operadorId}});
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
      const conciliado=await tx.movimentoFinanceiro.aggregate({where:{empresaId,pagamentoVenda:{vendaId:id}},_sum:{valor:true}});
      if(Number(conciliado._sum.valor??0)>0)throw new BadRequestException('Estorne as conciliações financeiras antes de cancelar a venda.');
      if(venda.clienteId)await tx.cliente.updateMany({where:{id:venda.clienteId,empresaId},data:{atualizadoEm:new Date()}});

      // 1. Devolve os produtos ao estoque e contabiliza cascos retornáveis
      for (const item of venda.itens) {
        const unidades = item.unidadesEstoque ?? item.quantidade;

        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoqueAtual: {
              increment: unidades,
            },
          },
        });


      }

      // Reverse the actual net quantities recorded at sale time, not the current product configuration.
      if(venda.clienteId){
        if(!venda.vasilhamesControlados&&venda.itens.some(i=>i.produto?.retornavel))throw new BadRequestException('Venda antiga sem histórico de cascos por tipo. Solicite conciliação antes de cancelar.');
        const movimentos=await tx.movimentacaoCasco.groupBy({by:['tipoVasilhameId'],where:{empresaId,vendaId:id},_sum:{quantidade:true}});
        for(const m of movimentos){const q=-(m._sum.quantidade??0);if(q)await aplicarCasco(tx,empresaId,venda.clienteId,{tipoVasilhameId:m.tipoVasilhameId,quantidade:q,origem:'ESTORNO',vendaId:id});}
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
            origem: 'ESTORNO',
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