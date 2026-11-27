import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { consultarModulos } from '../common/modulos/plano-modulos';
import { calcularCmv } from './dre-cmv';
import { RELATORIOS, podeRelatorio, periodoRelatorio, reposicao } from './catalogo-relatorios';
type Celula=string|number|null;
type Linha=Record<string,Celula>;
type Coluna={key:string;label:string;tipo?:'money'|'date'|'datetime'};
type Sessao={cargo?:string;permissoes?:string[]};
const col=(key:string,label:string,tipo?:Coluna['tipo']):Coluna=>({key,label,tipo});
const money=(key:string,label:string)=>col(key,label,'money');
const MAX=5000;
const dec=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
const total=(rows:Linha[],key:string)=>rows.reduce((s,r)=>s.plus(String(r[key]??0)),dec(0)).toFixed(2);
function limite<T>(rows:T[]){if(rows.length>MAX)throw new BadRequestException('Mais de 5000 registros. Reduza o período ou filtre o produto.');return rows;}
@Injectable()
export class CentralRelatoriosService {
 constructor(private readonly prisma:PrismaService){}
 async catalogo(empresaId:number,user:Sessao){
  const m=await consultarModulos(this.prisma,empresaId);
  if(!m.RELATORIOS_AVANCADOS)throw new ForbiddenException('Módulo de relatórios desativado.');
  return RELATORIOS.filter(r=>podeRelatorio(r.codigo,user)&&r.modulos.every(x=>m[x])).map(({modulos,...r})=>r);
 }
 async gerar(empresaId:number,user:Sessao,codigo:string,inicio?:string,fim?:string,busca?:string){
  const def=RELATORIOS.find(r=>r.codigo===codigo);
  if(!def)throw new NotFoundException('Relatório não encontrado.');
  if(!(await this.catalogo(empresaId,user)).some(r=>r.codigo===codigo))throw new ForbiddenException('Relatório não liberado para este acesso.');
  const p=def.periodo?periodoRelatorio(inicio,fim):undefined;
  const termo=(busca??'').trim().slice(0,120);
  const produtoBusca:Prisma.ProdutoWhereInput=termo?{OR:[{nome:{contains:termo,mode:'insensitive'}},{codigoBarras:{contains:termo} },...(/^\d{1,9}$/.test(termo)?[{id:Number(termo)}]:[])]}:{};
  const prod={empresaId,...produtoBusca};
  const venda={empresaId,status:'CONCLUIDA' as const,criadoEm:p};
  let colunas:Coluna[]=[],linhas:Linha[]=[],resumo:{label:string;valor:Celula;tipo?:'money'}[]=[],nota='';
  if(codigo==='001'||codigo==='002'){
   const baixo:Prisma.ProdutoWhereInput=codigo==='001'?{OR:[{estoqueAtual:{lte:0}},{estoqueAtual:{lte:this.prisma.produto.fields.estoqueMinimo}}]}:{};
   const produtos=limite(await this.prisma.produto.findMany({where:{empresaId,ativo:true,AND:[produtoBusca,baixo]},select:{id:true,nome:true,codigoBarras:true,estoqueAtual:true,estoqueMinimo:true,unidadeMedida:true,fardoQuantidade:true,categoria:{select:{nome:true}}},orderBy:[{estoqueAtual:'asc'},{nome:'asc'}],take:MAX+1}));
   colunas=[col('id','Código'),col('ean','Código de barras'),col('produto','Produto'),col('categoria','Categoria'),col('unidade','Un.'),col('saldo','Saldo'),col('minimo','Mínimo')];
   linhas=produtos.map(x=>{const r=reposicao(x.estoqueAtual,x.estoqueMinimo);return {id:x.id,ean:x.codigoBarras,produto:x.nome,categoria:x.categoria?.nome??'Sem categoria',unidade:x.unidadeMedida,saldo:x.estoqueAtual,minimo:x.estoqueMinimo,...(codigo==='001'?{sugerida:r.sugerida,situacao:r.situacao,fardos:x.fardoQuantidade&&x.fardoQuantidade>1?Math.ceil(r.sugerida/x.fardoQuantidade):null,comprar:''}:{})};});
   if(codigo==='001'){
    colunas.push(col('sugerida','Repor (un.)'),col('fardos','Fardos inteiros*'),col('situacao','Situação'),col('comprar','Comprar / anotação'));
    resumo=[{label:'Produtos em reposição',valor:linhas.length},{label:'Zerados',valor:linhas.filter(x=>Number(x.saldo)<=0).length},{label:'Unidades sugeridas',valor:linhas.reduce((s,x)=>s+Number(x.sugerida),0)}];
    nota='Sugestão = máximo(0, estoque mínimo − saldo). Produtos zerados sem mínimo ou no mínimo exigem decisão do comprador. Fardos são arredondados para cima quando a embalagem está cadastrada; não são quantidades adicionais. A lista não desconta pedidos de compra em aberto.';
   }else resumo=[{label:'Produtos',valor:linhas.length},{label:'Unidades em estoque',valor:linhas.reduce((s,x)=>s+Number(x.saldo),0)}];
  }else if(codigo==='003'){
   const hoje=new Date();const dia=new Date(hoje.toISOString().slice(0,10)+'T00:00:00Z');const fim=new Date(dia.getTime()+31*86400000);
   const rows=limite(await this.prisma.loteProduto.findMany({where:{empresaId,quantidade:{gt:0},dataVencimento:{lt:fim},produto:{...prod,ativo:true}},include:{produto:{select:{nome:true,codigoBarras:true}}},orderBy:{dataVencimento:'asc'},take:MAX+1}));
   colunas=[col('produto','Produto'),col('ean','Código de barras'),col('lote','Lote'),col('qtd','Quantidade'),col('validade','Validade','date'),col('situacao','Situação')];
   linhas=rows.map(x=>({produto:x.produto.nome,ean:x.produto.codigoBarras,lote:x.numeroLote??String(x.id),qtd:x.quantidade,validade:x.dataVencimento?.toISOString()??null,situacao:x.dataVencimento&&x.dataVencimento<dia?'Vencido':'A vencer'}));
   nota='Saldos registrados por lote; confira fisicamente antes de descartar.';
  }else if(codigo==='004'){
   const rows=limite(await this.prisma.venda.findMany({where:{...venda},select:{codigoVenda:true,criadoEm:true,valorTotal:true,desconto:true,funcionario:{select:{nome:true}},cliente:{select:{nome:true}}},orderBy:{criadoEm:'desc'},take:MAX+1}));
   colunas=[col('codigo','Venda'),col('data','Data','datetime'),col('operador','Operador'),col('cliente','Cliente'),money('desconto','Desconto'),money('total','Total')];
   linhas=rows.map(x=>({codigo:x.codigoVenda,data:x.criadoEm.toISOString(),operador:x.funcionario.nome,cliente:x.cliente?.nome??'Consumidor',desconto:x.desconto.toFixed(2),total:x.valorTotal.toFixed(2)}));
   resumo=[{label:'Vendas concluídas',valor:linhas.length},{label:'Total vendido',valor:total(linhas,'total'),tipo:'money'}];
  }else if(codigo==='005'){
   const rows=limite(await this.prisma.itemVenda.findMany({where:{venda,produto:prod},select:{produtoId:true,quantidade:true,unidadesEstoque:true,precoTotal:true,produto:{select:{nome:true,codigoBarras:true}}},take:MAX+1}));
   const mapa=new Map<number,{produto:string;ean:string|null;qtd:number;valor:Prisma.Decimal}>();
   for(const x of rows){const a=mapa.get(x.produtoId)??{produto:x.produto.nome,ean:x.produto.codigoBarras,qtd:0,valor:dec(0)};a.qtd+=x.unidadesEstoque??x.quantidade;a.valor=a.valor.plus(x.precoTotal);mapa.set(x.produtoId,a);}
   linhas=[...mapa.entries()].sort((a,b)=>b[1].qtd-a[1].qtd).map(([id,x])=>({id,produto:x.produto,ean:x.ean,qtd:x.qtd,valor:x.valor.toFixed(2)}));
   colunas=[col('id','Código'),col('produto','Produto'),col('ean','Código de barras'),col('qtd','Unidades'),money('valor','Valor dos itens')];
   nota='Valores dos itens antes de descontos globais e taxa de entrega. Registros antigos sem unidadesEstoque usam a quantidade registrada.';
  }else if(codigo==='006'){
   const rows=limite(await this.prisma.pagamentoVenda.groupBy({by:['formaPagamento','formaNome'],where:{venda},_sum:{valor:true,troco:true},_count:{id:true},take:MAX+1,orderBy:{formaPagamento:'asc'}}));
   colunas=[col('forma','Forma de pagamento'),col('qtd','Registros'),money('valor','Valor sem troco')];
   linhas=rows.map(x=>({forma:x.formaNome??x.formaPagamento,qtd:x._count.id,valor:dec(x._sum.valor??0).minus(x._sum.troco??0).toFixed(2)}));
   resumo=[{label:'Total das formas',valor:total(linhas,'valor'),tipo:'money'}];nota='Vendas concluídas; inclui fiado e não equivale ao dinheiro recebido no caixa.';
  }else if(codigo==='007'){
   const rows=limite(await this.prisma.movimentacaoEstoque.findMany({where:{empresaId,criadoEm:p,tipo:{in:['PERDA','AVARIA','AVARIA_PERDA']},produto:prod},include:{produto:{select:{nome:true,codigoBarras:true}}},orderBy:{criadoEm:'desc'},take:MAX+1}));
   colunas=[col('data','Data','datetime'),col('produto','Produto'),col('ean','Código de barras'),col('tipo','Tipo'),col('qtd','Quantidade'),col('motivo','Motivo')];
   linhas=rows.map(x=>({data:x.criadoEm.toISOString(),produto:x.produto.nome,ean:x.produto.codigoBarras,tipo:x.tipo,qtd:x.quantidade,motivo:x.motivo}));
  }else if(codigo==='008'){
   const rows=limite(await this.prisma.cliente.findMany({where:{empresaId,saldoDevedor:{gt:0}},select:{codigoCliente:true,nome:true,telefone:true,saldoDevedor:true},orderBy:{saldoDevedor:'desc'},take:MAX+1}));
   colunas=[col('id','Código'),col('cliente','Cliente'),col('telefone','Telefone'),money('saldo','Saldo devedor')];linhas=rows.map(x=>({id:x.codigoCliente,cliente:x.nome,telefone:x.telefone,saldo:x.saldoDevedor.toFixed(2)}));resumo=[{label:'Saldo devedor',valor:total(linhas,'saldo'),tipo:'money'}];
  }else if(codigo==='009'||codigo==='010'){
   const select={descricao:true,categoria:true,valor:true,valorBaixado:true,dataVencimento:true} as const;
   const where={empresaId,status:'PENDENTE' as const};
   const rows=limite(codigo==='009'?await this.prisma.contaPagar.findMany({where,select,orderBy:{dataVencimento:'asc'},take:MAX+1}):await this.prisma.contaReceber.findMany({where,select,orderBy:{dataVencimento:'asc'},take:MAX+1}));
   colunas=[col('descricao','Descrição'),col('categoria','Categoria'),col('vencimento','Vencimento','date'),money('valor','Valor'),money('baixado','Baixado'),money('saldo','Saldo')];
   linhas=rows.map(x=>({descricao:x.descricao,categoria:x.categoria,vencimento:x.dataVencimento.toISOString(),valor:x.valor.toFixed(2),baixado:x.valorBaixado.toFixed(2),saldo:x.valor.minus(x.valorBaixado).toFixed(2)}));resumo=[{label:'Saldo em aberto',valor:total(linhas,'saldo'),tipo:'money'}];
  }else if(codigo==='011'){
   const rows=limite(await this.prisma.caixa.findMany({where:{empresaId,status:'FECHADO',fechadoEm:p},include:{operador:{select:{nome:true}}},orderBy:{fechadoEm:'desc'},take:MAX+1}));
   colunas=[col('operador','Operador'),col('abertura','Abertura','datetime'),col('fechamento','Fechamento','datetime'),money('inicial','Inicial'),money('sistema','Sistema'),money('fisico','Físico'),money('diferenca','Diferença')];
   linhas=rows.map(x=>({operador:x.operador.nome,abertura:x.abertoEm.toISOString(),fechamento:x.fechadoEm?.toISOString()??null,inicial:x.saldoInicial.toFixed(2),sistema:x.saldoFinalSistema?.toFixed(2)??null,fisico:x.saldoFinalFisico?.toFixed(2)??null,diferenca:x.quebraDeCaixa?.toFixed(2)??null}));
  }else if(codigo==='012'){
   const rows=limite(await this.prisma.recebimentoCompra.findMany({where:{empresaId,estornadoEm:null,criadoEm:p,compra:{empresaId}},include:{compra:{select:{codigoCompra:true,fornecedorNome:true}}},orderBy:{criadoEm:'desc'},take:MAX+1}));
   colunas=[col('codigo','Compra'),col('data','Recebimento','datetime'),col('fornecedor','Fornecedor'),money('valor','Valor recebido')];linhas=rows.map(x=>({codigo:x.compra.codigoCompra,data:x.criadoEm.toISOString(),fornecedor:x.compra.fornecedorNome,valor:x.total.toFixed(2)}));resumo=[{label:'Total recebido',valor:total(linhas,'valor'),tipo:'money'}];
  }else if(codigo==='013'){
   // Custo histórico nas novas vendas; estimativa explícita para registros legados.
   const [v,itens,despesas,taxas]=await this.prisma.$transaction([
    this.prisma.venda.aggregate({where:venda,_sum:{subtotal:true,desconto:true,taxaEntrega:true,valorTotal:true}}),
    this.prisma.itemVenda.findMany({where:{venda,produto:{empresaId}},select:{unidadesEstoque:true,quantidade:true,custoHistorico:{select:{custoUnitario:true}},produto:{select:{precoCusto:true}}},take:MAX+1}),
    this.prisma.contaPagar.findMany({where:{empresaId,status:{not:'CANCELADO'},notaFiscalId:null,recebimentoCompraId:null,dataVencimento:{gte:new Date(inicio+'T00:00:00Z'),lt:new Date(new Date(fim+'T00:00:00Z').getTime()+86400000)},categoriaCadastro:{empresaId,tipo:{in:['CUSTO_FIXO','CUSTO_VARIAVEL']}}},select:{valor:true,categoriaCadastro:{select:{tipo:true}}},take:MAX+1}),
    this.prisma.pagamentoVenda.aggregate({where:{venda},_sum:{valorTaxa:true}}),
   ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
   limite(itens);limite(despesas);
   const receita=dec(v._sum.valorTotal??0),custos=calcularCmv(itens),cmv=custos.historico.plus(custos.estimado);
   const fixas=despesas.filter(x=>x.categoriaCadastro?.tipo==='CUSTO_FIXO').reduce((s,x)=>s.plus(x.valor),dec(0));
   const variaveis=despesas.filter(x=>x.categoriaCadastro?.tipo==='CUSTO_VARIAVEL').reduce((s,x)=>s.plus(x.valor),dec(0));
   const taxa=dec(taxas._sum.valorTaxa??0),bruto=receita.minus(cmv),resultado=bruto.minus(fixas).minus(variaveis).minus(taxa);
   const {semCusto,legados,semUnidades}=custos;
   colunas=[col('descricao','Descrição'),money('valor','Valor')];
   linhas=[{descricao:'Receita de vendas concluídas (descontos e entrega incluídos)',valor:receita.toFixed(2)},{descricao:'(-) CMV com custo registrado na venda',valor:custos.historico.toFixed(2)},{descricao:'(-) CMV estimado de itens sem custo histórico',valor:custos.estimado.toFixed(2)},{descricao:'(=) Margem bruta estimada',valor:bruto.toFixed(2)},{descricao:'(-) Custos fixos classificados',valor:fixas.toFixed(2)},{descricao:'(-) Custos variáveis classificados',valor:variaveis.toFixed(2)},{descricao:'(-) Taxas registradas nas vendas',valor:taxa.toFixed(2)},{descricao:'(=) Resultado parcial estimado',valor:resultado.toFixed(2)}];
   resumo=[{label:'Resultado parcial estimado',valor:resultado.toFixed(2),tipo:'money'},{label:'Itens sem custo positivo',valor:semCusto},{label:'Itens sem custo histórico',valor:legados},{label:'Itens sem unidades de estoque',valor:semUnidades}];
   nota='Não é DRE contábil oficial nem lucro líquido. CMV das novas vendas usa custo congelado na baixa; vendas anteriores sem snapshot usam custo atual como estimativa separada. Custo zero ou ausência de unidades de estoque pode distorcer o resultado. Despesas classificadas por vencimento, não competência. Exclui compras vinculadas a XML/recebimento para evitar duplicação de CMV. Não inclui impostos, receitas externas, despesas sem classificação, perdas ou taxas não registradas. Evite classificar taxas de venda também como despesas para não duplicá-las.';
  }
  return {codigo:def.codigo,nome:def.nome,geradoEm:new Date().toISOString(),inicio:def.periodo?inicio:null,fim:def.periodo?fim:null,colunas,linhas,resumo,nota};
 }
}
