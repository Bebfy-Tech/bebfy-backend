import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { createHash } from 'crypto';
import { resolverModulos } from '../../common/modulos/plano-modulos';
import { parcelasMensais } from '../../financeiro/financeiro-regras';
import { CriarCompraDto, ReceberCompraDto } from './compras.dto';
import { converterQuantidade, dataCompra, ratearTotal, custoMedio, valorRecebido } from './compras-regras';

type Tx = Prisma.TransactionClient;
const incluir = { itens: { orderBy: { produtoId: 'asc' as const } }, recebimentos: { orderBy: { criadoEm: 'desc' as const }, include: { itens: { include: { lote: true } }, contasPagar: { select: { id: true, descricao: true, valor: true, status: true, dataVencimento: true } } } } } satisfies Prisma.CompraInclude;
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

  async receber(empresaId: number, id: string, dto: ReceberCompraDto, operadorId: string) {
    if (!dto.observacao.trim()) throw new BadRequestException('Informe a conferência e o motivo caso não gere conta a pagar.');
    const itens = [...dto.itens].sort((a,b) => a.itemCompraId.localeCompare(b.itemCompraId));
    if (!itens.length || new Set(itens.map(i => i.itemCompraId)).size !== itens.length)
      throw new BadRequestException('Itens do recebimento inválidos ou repetidos.');
    const assinatura = createHash('sha256').update(JSON.stringify({
      id, itens: itens.map(i=>[i.itemCompraId,i.unidades,i.numeroLote?.trim()||null,i.validade||null]),
      chaveNfe: dto.chaveNfe??null, observacao: dto.observacao.trim(), gerarContaPagar: dto.gerarContaPagar,
      vencimento: dto.vencimento??null, parcelas: dto.parcelas??1
    })).digest('hex');
    return this.serial(async tx => {
      const anterior = await tx.recebimentoCompra.findFirst({ where: { empresaId, chaveOperacao: dto.chaveOperacao } });
      if (anterior) {
        if (anterior.estornadoEm) throw new ConflictException('Recebimento original estornado. Confira o histórico.');
        if (anterior.compraId !== id || anterior.assinatura !== assinatura) throw new ConflictException('Chave utilizada com outros dados.');
        return this.obter(tx, empresaId, id);
      }
      // Updating the tenant row coordinates manual receiving with XML imports, even under serializable isolation.
      await tx.empresa.update({where:{id:empresaId},data:{atualizadoEm:new Date()}});
      const c = await this.obter(tx, empresaId, id);
      if (!['AGUARDANDO','PARCIAL'].includes(c.status)) throw new BadRequestException('Confirme o pedido antes de receber.');
      await this.fornecedorAtivo(tx, empresaId, c.fornecedorId);
      if (dto.chaveNfe && (await tx.notaFiscal.findUnique({where:{empresaId_chaveAcesso:{empresaId,chaveAcesso:dto.chaveNfe}}}) || await tx.recebimentoCompra.findFirst({where:{empresaId,chaveNfe:dto.chaveNfe}})))
        throw new ConflictException('Esta NF-e já possui entrada registrada.');
      const empresa = await tx.empresa.findUniqueOrThrow({where:{id:empresaId},select:{plano:{select:{modulosPadrao:true}},modulosAtivos:{select:{modulo:true,ativo:true}}}});
      const lotes = resolverModulos(empresa).ESTOQUE_LOTES;
      const rows = itens.map(i => {
        const item = c.itens.find(x => x.id === i.itemCompraId);
        if (!item) throw new BadRequestException('Item não pertence ao pedido.');
        if ((i.numeroLote || i.validade) && !lotes) throw new BadRequestException('Módulo de lotes desativado.');
        return {i,item,valor:valorRecebido(item.total,item.unidades,item.unidadesRecebidas,i.unidades)};
      }).sort((a,b)=>a.item.produtoId-b.item.produtoId);
      const total = rows.reduce((v,r)=>v.plus(r.valor),d(0));
      const parcelas = dto.gerarContaPagar && total.gt(0) ? parcelasMensais(Number(total),dto.vencimento??'','PARCELADA',dto.parcelas??1) : [];
      const rec = await tx.recebimentoCompra.create({data:{empresaId,compraId:id,total,chaveNfe:dto.chaveNfe,observacao:dto.observacao.trim(),operadorId,chaveOperacao:dto.chaveOperacao,assinatura}});
      for (const {i,item,valor} of rows) {
        const p = await tx.produto.findFirst({where:{empresaId,id:item.produtoId,ativo:true}});
        if (!p || p.unidadeMedida !== item.unidadeBase || p.estoqueAtual+i.unidades>2147483647) throw new BadRequestException('Produto indisponível ou unidade de estoque alterada.');
        const novo = custoMedio(p.estoqueAtual,p.precoCusto,i.unidades,valor);
        const update = await tx.produto.updateMany({where:{empresaId,id:p.id,ativo:true,estoqueAtual:p.estoqueAtual,precoCusto:p.precoCusto,unidadeMedida:item.unidadeBase},data:{estoqueAtual:{increment:i.unidades},precoCusto:novo}});
        if (!update.count) throw new ConflictException('Estoque ou custo alterado. Confira novamente.');
        const atualizado=await tx.produto.findUniqueOrThrow({where:{id:p.id},select:{atualizadoEm:true}});
        const ir=await tx.itemRecebimentoCompra.create({data:{recebimentoId:rec.id,itemCompraId:item.id,unidades:i.unidades,valor,estoqueAnterior:p.estoqueAtual,estoquePosterior:p.estoqueAtual+i.unidades,custoAnterior:p.precoCusto,custoNovo:novo,produtoAtualizadoEm:atualizado.atualizadoEm,custoUnitario:valor.div(i.unidades).toDecimalPlaces(6)}});
        if (i.numeroLote?.trim()||i.validade) await tx.loteProduto.create({data:{empresaId,produtoId:p.id,itemRecebimentoId:ir.id,quantidade:i.unidades,numeroLote:i.numeroLote?.trim()||null,dataVencimento:i.validade?dataCompra(i.validade):null}});
        await tx.movimentacaoEstoque.create({data:{empresaId,produtoId:p.id,tipo:'ENTRADA_COMPRA',quantidade:i.unidades,motivo:'Compra #'+c.codigoCompra+' / recebimento '+rec.id,observacao:dto.observacao.trim()}});
        await tx.historicoCusto.create({data:{produtoId:p.id,custoAnterior:p.precoCusto,custoNovo:novo}});
        await tx.itemCompra.update({where:{id:item.id},data:{unidadesRecebidas:{increment:i.unidades}}});
      }
      for (let n=0;n<parcelas.length;n++) await tx.contaPagar.create({data:{empresaId,fornecedorId:c.fornecedorId,recebimentoCompraId:rec.id,descricao:'Compra #'+c.codigoCompra+' / '+c.fornecedorNome,categoria:'COMPRA DE MERCADORIAS',...parcelas[n],grupoLancamento:parcelas.length>1?rec.id:null,parcela:parcelas.length>1?n+1:null,totalParcelas:parcelas.length>1?parcelas.length:null}});
      const completo=c.itens.every(x=>x.unidadesRecebidas+(itens.find(i=>i.itemCompraId===x.id)?.unidades??0)===x.unidades);
      const r=await tx.compra.updateMany({where:{id,empresaId,status:c.status},data:{status:completo?'RECEBIDA':'PARCIAL'}});
      if(!r.count)throw new ConflictException('Pedido alterado.');
      return this.obter(tx,empresaId,id);
    });
  }

  /** Estorno integral de uma entrada recente, sem apagar a trilha de auditoria. */
  async estornarRecebimento(empresaId:number,id:string,recebimentoId:string,motivo:string,operadorId:string){
    const texto=motivo.trim();
    if(!texto)throw new BadRequestException('Informe o motivo do estorno.');
    return this.serial(async tx=>{
      await tx.empresa.update({where:{id:empresaId},data:{atualizadoEm:new Date()}});
      const c=await this.obter(tx,empresaId,id);
      const r=c.recebimentos.find(x=>x.id===recebimentoId);
      if(!r)throw new NotFoundException('Recebimento não encontrado neste pedido.');
      if(r.estornadoEm){
        if(r.motivoEstorno===texto)return c;
        throw new ConflictException('Recebimento já estornado.');
      }
      if(!['PARCIAL','RECEBIDA'].includes(c.status))throw new BadRequestException('Pedido encerrado ou situação incompatível.');
      if(c.recebimentos.find(x=>!x.estornadoEm)?.id!==r.id)throw new BadRequestException('Somente o recebimento ativo mais recente pode ser estornado.');
      // Never undo any payable with a payment history, even if the payment itself was reversed.
      const contas=await tx.contaPagar.findMany({where:{empresaId,recebimentoCompraId:r.id},include:{_count:{select:{baixas:true}}}});
      for(const conta of contas){
        if(conta.status==='PAGO'||!conta.valorBaixado.isZero()||conta._count.baixas)
          throw new BadRequestException('Há histórico de pagamento. A devolução exige conciliação financeira específica.');
        if(conta.status==='PENDENTE'){
          const res=await tx.contaPagar.updateMany({where:{empresaId,id:conta.id,status:'PENDENTE',valorBaixado:0},data:{status:'CANCELADO'}});
          if(!res.count)throw new ConflictException('Conta alterada durante o estorno.');
        }
      }
      const itens=r.itens.map(i=>({i,pedido:c.itens.find(x=>x.id===i.itemCompraId)!})).sort((a,b)=>a.pedido.produtoId-b.pedido.produtoId);
      for(const {i,pedido} of itens){
        if(!i.produtoAtualizadoEm||pedido.unidadesRecebidas<i.unidades)throw new BadRequestException('Recebimento sem referência segura para estorno automático.');
        const p=await tx.produto.findFirst({where:{empresaId,id:pedido.produtoId}});
        if(!p||p.estoqueAtual!==i.estoquePosterior||!p.precoCusto.equals(i.custoNovo)||p.atualizadoEm.getTime()!==i.produtoAtualizadoEm.getTime()||p.unidadeMedida!==pedido.unidadeBase)
          throw new BadRequestException('Produto alterado após a entrada: '+pedido.produtoNome+'. Estorno automático indisponível.');
        const movimentos=await tx.movimentacaoEstoque.count({where:{empresaId,produtoId:p.id,criadoEm:{gte:r.criadoEm},NOT:{motivo:'Compra #'+c.codigoCompra+' / recebimento '+r.id}}});
        if(movimentos)throw new BadRequestException('Existem outras movimentações após a entrada de '+pedido.produtoNome+'.');
        if(i.lote){
          const lote=await tx.loteProduto.updateMany({where:{empresaId,produtoId:p.id,id:i.lote.id,itemRecebimentoId:i.id,quantidade:i.unidades},data:{quantidade:0}});
          if(!lote.count)throw new ConflictException('Lote alterado. Estorno indisponível.');
        }
        const updated=await tx.produto.updateMany({where:{empresaId,id:p.id,estoqueAtual:i.estoquePosterior,precoCusto:i.custoNovo,atualizadoEm:i.produtoAtualizadoEm},data:{estoqueAtual:i.estoqueAnterior,precoCusto:i.custoAnterior}});
        if(!updated.count)throw new ConflictException('Produto alterado durante o estorno.');
        await tx.movimentacaoEstoque.create({data:{empresaId,produtoId:p.id,tipo:'AJUSTE_SAIDA',quantidade:i.unidades,motivo:'Estorno compra #'+c.codigoCompra+' / recebimento '+r.id,observacao:texto}});
        await tx.historicoCusto.create({data:{produtoId:p.id,custoAnterior:i.custoNovo,custoNovo:i.custoAnterior}});
        await tx.itemCompra.update({where:{id:pedido.id},data:{unidadesRecebidas:{decrement:i.unidades}}});
      }
      const rec=await tx.recebimentoCompra.updateMany({where:{id:r.id,empresaId,compraId:id,estornadoEm:null},data:{estornadoEm:new Date(),estornadoPor:operadorId,motivoEstorno:texto}});
      if(!rec.count)throw new ConflictException('Recebimento alterado.');
      const parcial=c.itens.some(i=>i.unidadesRecebidas-(r.itens.find(x=>x.itemCompraId===i.id)?.unidades??0)>0);
      const compra=await tx.compra.updateMany({where:{empresaId,id,status:c.status},data:{status:parcial?'PARCIAL':'AGUARDANDO'}});
      if(!compra.count)throw new ConflictException('Pedido alterado.');
      return this.obter(tx,empresaId,id);
    });
  }
}
