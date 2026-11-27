import { BadRequestException } from '@nestjs/common';
import { Prisma, FormaPagamento } from '@prisma/client';
import { inicializarCadastros } from './cadastros-padroes';
type Tx=Prisma.TransactionClient;
const baseValida=['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO'];
type Uso='pdv'|'fiado';
export async function formasOperacionais(tx:Tx,empresaId:number,uso:Uso){
 await inicializarCadastros(tx,empresaId);
 const rows=await tx.cadastroFinanceiro.findMany({where:{empresaId,tipo:'FORMA_PAGAMENTO',ativo:true,...(uso==='pdv'?{permitePdv:true}:{permiteReceber:true,fiado:false}),OR:[...(uso==='pdv'?[{fiado:true}]:[]),{fiado:false,formaBase:{in:['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO']}}]},select:{id:true,nome:true,formaBase:true,fiado:true,maxParcelas:true,taxas:true,contaId:true,operadoraId:true,conta:{select:{nome:true,ativo:true}},operadora:{select:{nome:true,ativo:true}}},orderBy:{nome:'asc'}});
 return rows.filter(r=>(!r.conta||r.conta.ativo)&&(!r.operadora||r.operadora.ativo));
}
export function estimarTaxa(valor:Prisma.Decimal,condicao:{taxa:number;prazoDias:number}|undefined){
 if(!condicao)return {taxaPercentual:null,valorTaxa:null,valorLiquidoPrevisto:null,prazoRecebimentoDias:null};
 const taxaPercentual=new Prisma.Decimal(condicao.taxa);
 const valorTaxa=valor.mul(taxaPercentual).div(100).toDecimalPlaces(2);
 return {taxaPercentual,valorTaxa,valorLiquidoPrevisto:valor.minus(valorTaxa),prazoRecebimentoDias:condicao.prazoDias};
}
export async function resolverPagamento(tx:Tx,empresaId:number,uso:Uso,base:FormaPagamento,id:string|undefined,parcelas:number,valorLiquido:number){
 if(!Number.isInteger(parcelas)||parcelas<1||parcelas>24||base!=='CARTAO_CREDITO'&&parcelas!==1)throw new BadRequestException('Parcelamento inválido.');
 if(base!=='FIADO'&&!baseValida.includes(base)||uso==='fiado'&&base==='FIADO')throw new BadRequestException('Forma não suportada.');
 const opcoes=(await formasOperacionais(tx,empresaId,uso)).filter(r=>base==='FIADO'?r.fiado:!r.fiado&&r.formaBase===base);
 const forma=id?opcoes.find(r=>r.id===id):opcoes.length===1?opcoes[0]:null;
 if(!forma)throw new BadRequestException('Forma de pagamento indisponível ou ambígua. Selecione uma opção ativa.');
 if(parcelas>forma.maxParcelas)throw new BadRequestException('Parcelamento acima do limite cadastrado.');
 // Store a snapshot rather than recomputing old sales from current rates.
 const condicao=Array.isArray(forma.taxas)?forma.taxas.find((x):x is Prisma.JsonObject=>!!x&&typeof x==='object'&&!Array.isArray(x)&&x.parcelas===parcelas):undefined;
 const termos=condicao&&typeof condicao.taxa==='number'&&typeof condicao.prazoDias==='number'?{taxa:condicao.taxa,prazoDias:condicao.prazoDias}:undefined;
 if(parcelas>1&&!termos)throw new BadRequestException('Configure taxa e prazo para este parcelamento.');
 return {formaCadastroId:forma.id,formaNome:forma.nome,parcelasPagamento:parcelas,...estimarTaxa(new Prisma.Decimal(valorLiquido),termos),contaFinanceiraId:forma.contaId,contaFinanceiraNome:forma.conta?.nome??null,operadoraCadastroId:forma.operadoraId,operadoraNome:forma.operadora?.nome??null};
}
