import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { ConciliarDto, EstornarMovimentoDto, TransferirDto } from './dto/movimento-financeiro.dto';
type Tx=Prisma.TransactionClient;
const dec=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
const zero=()=>dec(0);
const formas=['PIX','CARTAO_DEBITO','CARTAO_CREDITO'] as const;
export const valorBaixa=(b:{principal:Prisma.Decimal;juros:Prisma.Decimal;multa:Prisma.Decimal;desconto:Prisma.Decimal})=>b.principal.plus(b.juros).plus(b.multa).minus(b.desconto);
@Injectable()
export class MovimentosFinanceirosService{
 constructor(private readonly prisma:PrismaService){}
 private async serial<T>(f:(tx:Tx)=>Promise<T>){try{return await this.prisma.$transaction(f,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(e.code))throw new ConflictException('Operação concorrente ou repetida. Atualize e confira o histórico antes de repetir.');throw e;}}
 private async conta(tx:Tx,empresaId:number,id:string){
  const c=await tx.cadastroFinanceiro.findFirst({where:{id,empresaId,tipo:'CONTA',ativo:true}});if(!c)throw new BadRequestException('Conta financeira indisponível.');return c;
 }
 private async saldo(tx:Tx,empresaId:number,id:string,inicial:Prisma.Decimal){
  const [entrada,saida,baixas]=await Promise.all([tx.movimentoFinanceiro.aggregate({where:{empresaId,destinoId:id},_sum:{valor:true}}),tx.movimentoFinanceiro.aggregate({where:{empresaId,origemId:id},_sum:{valor:true}}),tx.baixaFinanceira.findMany({where:{contaFinanceiraId:id,OR:[{contaPagar:{empresaId}},{contaReceber:{empresaId}}]}})]);
  return baixas.reduce((s,b)=>s.plus(valorBaixa(b).mul(b.contaPagarId?-1:1)),inicial.plus(entrada._sum.valor??0).minus(saida._sum.valor??0));
 }
 async contas(empresaId:number){
  return this.prisma.$transaction(async tx=>{const cs=await tx.cadastroFinanceiro.findMany({where:{empresaId,tipo:'CONTA'},select:{id:true,nome:true,ativo:true,tipoConta:true,saldoInicial:true},orderBy:{nome:'asc'}});return Promise.all(cs.map(async c=>({...c,saldo:await this.saldo(tx,empresaId,c.id,c.saldoInicial)})));},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 private motivo(v:string){if(!v.trim())throw new BadRequestException('Informe a descrição ou motivo.');return v.trim();}
 async transferir(empresaId:number,dto:TransferirDto,operadorId:string){
  if(dto.origemId===dto.destinoId)throw new BadRequestException('Selecione contas diferentes.');
  return this.serial(async tx=>{
   const old=await tx.movimentoFinanceiro.findFirst({where:{empresaId,chaveOperacao:dto.chaveOperacao}});
   if(old){if(old.tipo!=='TRANSFERENCIA'||old.estornoDeId||old.origemId!==dto.origemId||old.destinoId!==dto.destinoId||!old.valor.equals(dto.valor)||old.observacao!==dto.observacao.trim())throw new ConflictException('Chave já utilizada.');return old;}
   const a=await this.conta(tx,empresaId,dto.origemId),b=await this.conta(tx,empresaId,dto.destinoId);
   if((await this.saldo(tx,empresaId,a.id,a.saldoInicial)).lt(dto.valor))throw new BadRequestException('Saldo gerencial insuficiente na origem.');
   return tx.movimentoFinanceiro.create({data:{empresaId,tipo:'TRANSFERENCIA',origemId:a.id,destinoId:b.id,origemNome:a.nome,destinoNome:b.nome,valor:dto.valor,observacao:this.motivo(dto.observacao),operadorId,chaveOperacao:dto.chaveOperacao}});
  });
 }
 async recebiveis(empresaId:number){
  const [v,f]=await Promise.all([this.prisma.pagamentoVenda.findMany({where:{formaPagamento:{in:[...formas]},venda:{empresaId,status:'CONCLUIDA',statusAcerto:'CONCLUIDO'}},include:{venda:{select:{codigoVenda:true,criadoEm:true,acertoEm:true}},movimentosFinanceiros:{select:{valor:true}}},orderBy:{criadoEm:'desc'}}),this.prisma.historicoFiado.findMany({where:{origem:'RECEBIMENTO',formaRecebimento:{in:[...formas]},cliente:{empresaId}},include:{cliente:{select:{nome:true}},movimentosFinanceiros:{select:{valor:true}}},orderBy:{criadoEm:'desc'}})]);
  const map=(p:typeof v[number]|typeof f[number])=>{
   const venda='venda' in p;
   const bruto=venda?p.valor.minus(p.troco):p.valor;
   const conciliado=p.movimentosFinanceiros.reduce((n,m)=>n.plus(m.valor),zero());
   const liquido=p.valorLiquidoPrevisto??((venda?p.formaPagamento:p.formaRecebimento)==='PIX'?bruto:null);
   const data=venda?p.venda.acertoEm??p.criadoEm:p.criadoEm;
   const previsao=p.prazoRecebimentoDias==null?null:new Date(data.getTime()+p.prazoRecebimentoDias*86400000);
   return {id:p.id,fonte:venda?'VENDA':'FIADO',descricao:venda?'Venda #'+p.venda.codigoVenda:'Fiado · '+p.cliente.nome,forma:p.formaNome??(venda?p.formaPagamento:p.formaRecebimento),formaBase:venda?p.formaPagamento:p.formaRecebimento,parcelas:p.parcelasPagamento,bruto,valorTaxa:p.valorTaxa,liquido,conciliado,saldo:(liquido??bruto).minus(conciliado),data,previsao,contaId:p.contaFinanceiraId,contaNome:p.contaFinanceiraNome,operadora:p.operadoraNome};
  };
  return [...v.map(map),...f.map(map)].sort((a,b)=>b.data.getTime()-a.data.getTime());
 }
 async conciliar(empresaId:number,dto:ConciliarDto,operadorId:string){
  return this.serial(async tx=>{
   const link=dto.fonte==='VENDA'?{pagamentoVendaId:dto.fonteId}:{historicoFiadoId:dto.fonteId};
   const old=await tx.movimentoFinanceiro.findFirst({where:{empresaId,chaveOperacao:dto.chaveOperacao}});
   if(old){if(old.tipo!=='CONCILIACAO'||old.estornoDeId||old.pagamentoVendaId!==(dto.fonte==='VENDA'?dto.fonteId:null)||old.historicoFiadoId!==(dto.fonte==='FIADO'?dto.fonteId:null)||old.destinoId!==dto.destinoId||!old.valor.equals(dto.valor)||old.observacao!==dto.observacao.trim())throw new ConflictException('Chave já utilizada.');return old;}
   const destino=await this.conta(tx,empresaId,dto.destinoId);
   let limite:Prisma.Decimal;
   if(dto.fonte==='VENDA'){
    const p=await tx.pagamentoVenda.findFirst({where:{id:dto.fonteId,formaPagamento:{in:[...formas]},venda:{empresaId,status:'CONCLUIDA',statusAcerto:'CONCLUIDO'}}});
    if(!p)throw new NotFoundException('Pagamento não disponível para conciliação.');
    const lock=await tx.venda.updateMany({where:{id:p.vendaId,empresaId,status:'CONCLUIDA',statusAcerto:'CONCLUIDO'},data:{status:'CONCLUIDA'}});
    if(!lock.count)throw new ConflictException('Venda alterada.');
    limite=p.valorLiquidoPrevisto??p.valor.minus(p.troco);
   }else{
    const p=await tx.historicoFiado.findFirst({where:{id:dto.fonteId,origem:'RECEBIMENTO',formaRecebimento:{in:[...formas]},cliente:{empresaId}}});
    if(!p)throw new NotFoundException('Recebimento não disponível.');
    limite=p.valorLiquidoPrevisto??p.valor;
   }
   const soma=await tx.movimentoFinanceiro.aggregate({where:{empresaId,...link},_sum:{valor:true}});
   if(dec(soma._sum.valor??0).plus(dto.valor).gt(limite))throw new BadRequestException('Valor excede o saldo disponível para conciliação.');
   return tx.movimentoFinanceiro.create({data:{empresaId,tipo:'CONCILIACAO',...link,destinoId:destino.id,destinoNome:destino.nome,valor:dto.valor,observacao:this.motivo(dto.observacao),operadorId,chaveOperacao:dto.chaveOperacao}});
  });
 }
 async estornar(empresaId:number,id:string,dto:EstornarMovimentoDto,operadorId:string){
  return this.serial(async tx=>{
   const old=await tx.movimentoFinanceiro.findFirst({where:{empresaId,chaveOperacao:dto.chaveOperacao}});
   if(old){if(old.estornoDeId!==id||old.observacao!==dto.motivo.trim())throw new ConflictException('Chave já utilizada.');return old;}
   const m=await tx.movimentoFinanceiro.findFirst({where:{id,empresaId,estornoDeId:null}});
   if(!m||await tx.movimentoFinanceiro.findUnique({where:{estornoDeId:id}}))throw new BadRequestException('Movimento inexistente ou já estornado.');
   return tx.movimentoFinanceiro.create({data:{empresaId,tipo:m.tipo,origemId:m.origemId,destinoId:m.destinoId,origemNome:m.origemNome,destinoNome:m.destinoNome,pagamentoVendaId:m.pagamentoVendaId,historicoFiadoId:m.historicoFiadoId,valor:m.valor.neg(),observacao:this.motivo(dto.motivo),operadorId,chaveOperacao:dto.chaveOperacao,estornoDeId:id}});
  });
 }
 async historico(empresaId:number){
  const [movimentos,baixas]=await Promise.all([this.prisma.movimentoFinanceiro.findMany({where:{empresaId},orderBy:{criadoEm:'desc'}}),this.prisma.baixaFinanceira.findMany({where:{OR:[{contaPagar:{empresaId}},{contaReceber:{empresaId}}]},include:{contaPagar:{select:{descricao:true}},contaReceber:{select:{descricao:true}}},orderBy:{criadoEm:'desc'}})]);
  return {movimentos,baixas};
 }
}
