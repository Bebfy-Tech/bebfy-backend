import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CriarContaDto, BaixarContaDto } from './dto/criar-conta.dto';
import { Prisma, StatusConta } from '@prisma/client';
import { randomUUID } from 'crypto';
import { parcelasMensais } from './financeiro-regras';
import { consultarModulos } from '../common/modulos/plano-modulos';
type TipoConta='pagar'|'receber';
type Tx=Prisma.TransactionClient;
const dec=(v:Prisma.Decimal.Value)=>new Prisma.Decimal(v);
@Injectable()
export class FinanceiroService {
 constructor(private readonly prisma:PrismaService){}
 private async conta(tx:Tx,empresaId:number,tipo:TipoConta,id:string){
  const c=tipo==='pagar'?await tx.contaPagar.findFirst({where:{id,empresaId}}):await tx.contaReceber.findFirst({where:{id,empresaId}});
  if(!c)throw new NotFoundException('Conta inexistente nesta empresa.');return c;
 }
 private async atualizar(tx:Tx,empresaId:number,tipo:TipoConta,c:Awaited<ReturnType<FinanceiroService['conta']>>,valorBaixado:Prisma.Decimal,status:StatusConta){
  const where={id:c.id,empresaId,status:c.status,valorBaixado:c.valorBaixado};
  const base={valorBaixado,status};
  const r=tipo==='pagar'?await tx.contaPagar.updateMany({where,data:{...base,dataPagamento:status==='PAGO'?new Date():null}}):await tx.contaReceber.updateMany({where,data:{...base,dataRecebimento:status==='PAGO'?new Date():null}});
  if(r.count!==1)throw new ConflictException('Conta alterada. Atualize e confira o histórico.');
 }
 async criar(empresaId:number,tipo:TipoConta,dto:CriarContaDto){
  const descricao=dto.descricao.trim();if(!descricao)throw new BadRequestException('Informe a descrição.');
  if(tipo==='pagar'&&dto.clienteId||tipo==='receber'&&dto.fornecedorId)throw new BadRequestException('Vínculo incompatível com o lançamento.');
  const modo=dto.modalidade??'UNICA',n=modo==='UNICA'?1:dto.parcelas??0;
  const parcelas=parcelasMensais(dto.valor,dto.dataVencimento,modo,n);
  return this.prisma.$transaction(async tx=>{
   if(dto.fornecedorId&&!await tx.fornecedor.findFirst({where:{id:dto.fornecedorId,empresaId}}))throw new BadRequestException('Fornecedor não encontrado.');
   if(dto.clienteId&&!await tx.cliente.findFirst({where:{id:dto.clienteId,empresaId}}))throw new BadRequestException('Cliente não encontrado.');
   const grupo=n>1?randomUUID():null;
   const contas=[];
   for(let i=0;i<n;i++){
    const dados={empresaId,descricao,categoria:dto.categoria?.trim()||'OUTROS',observacao:dto.observacao?.trim(),...parcelas[i],grupoLancamento:grupo,parcela:n>1?i+1:null,totalParcelas:n>1?n:null,chaveLancamento:dto.chaveLancamento?dto.chaveLancamento+':'+(i+1):null};
    contas.push(tipo==='pagar'?await tx.contaPagar.create({data:{...dados,fornecedorId:dto.fornecedorId}}):await tx.contaReceber.create({data:{...dados,clienteId:dto.clienteId}}));
   }
   return n===1?contas[0]:{contas};
  }).catch(e=>{if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')throw new ConflictException('Lançamento já registrado. Confira a lista antes de repetir.');throw e;});
 }
 async listar(empresaId:number,tipo:TipoConta,status?:StatusConta){
  const where={empresaId,...(status?{status}:{})};
  return tipo==='pagar'?this.prisma.contaPagar.findMany({where,include:{fornecedor:{select:{id:true,razaoSocial:true}},baixas:{orderBy:{criadoEm:'desc'}}},orderBy:{dataVencimento:'asc'}}):this.prisma.contaReceber.findMany({where,include:{cliente:{select:{id:true,nome:true,codigoCliente:true}},baixas:{orderBy:{criadoEm:'desc'}}},orderBy:{dataVencimento:'asc'}});
 }
 private async registrarBaixa(tx:Tx,empresaId:number,tipo:TipoConta,id:string,dto:Omit<BaixarContaDto,'chaveOperacao'>&{chaveOperacao?:string},operadorId?:string){
  const c=await this.conta(tx,empresaId,tipo,id),link=tipo==='pagar'?{contaPagarId:id}:{contaReceberId:id};
  const principal=dec(dto.principal),juros=dec(dto.juros??0),multa=dec(dto.multa??0),desconto=dec(dto.desconto??0);
  if(dto.chaveOperacao){
   const b=await tx.baixaFinanceira.findFirst({where:{...link,chaveOperacao:dto.chaveOperacao}});
   if(b){if(!b.principal.equals(principal)||!b.juros.equals(juros)||!b.multa.equals(multa)||!b.desconto.equals(desconto)||b.forma!==dto.forma||b.observacao!==(dto.observacao?.trim()||null))throw new ConflictException('Chave de baixa já utilizada com outros dados.');return c;}
  }
  const novo=c.valorBaixado.plus(principal);
  if(c.status!=='PENDENTE'||principal.lte(0)||novo.gt(c.valor)||juros.lt(0)||multa.lt(0)||desconto.lt(0)||desconto.gt(principal.plus(juros).plus(multa)))throw new BadRequestException('Valor da baixa ou saldo inválido.');
  await this.atualizar(tx,empresaId,tipo,c,novo,novo.equals(c.valor)?'PAGO':'PENDENTE');
  await tx.baixaFinanceira.create({data:{...link,principal,juros,multa,desconto,forma:dto.forma,operadorId,observacao:dto.observacao?.trim()||null,chaveOperacao:dto.chaveOperacao}});
  return this.conta(tx,empresaId,tipo,id);
 }
 async baixar(empresaId:number,tipo:TipoConta,id:string,dto:BaixarContaDto,operadorId:string){return this.prisma.$transaction(tx=>this.registrarBaixa(tx,empresaId,tipo,id,dto,operadorId));}
 async alterarStatus(empresaId:number,tipo:TipoConta,id:string,status:'PAGO'|'CANCELADO',operadorId?:string){
  return this.prisma.$transaction(async tx=>{
   const c=await this.conta(tx,empresaId,tipo,id);
   if(c.status!=='PENDENTE')throw new BadRequestException('Conta não pendente.');
   if(status==='CANCELADO'){if(!c.valorBaixado.isZero())throw new BadRequestException('Estorne as baixas antes de cancelar.');await this.atualizar(tx,empresaId,tipo,c,dec(0),'CANCELADO');return this.conta(tx,empresaId,tipo,id);}
   return this.registrarBaixa(tx,empresaId,tipo,id,{principal:Number(c.valor.minus(c.valorBaixado)),forma:'NAO_INFORMADO'},operadorId);
  });
 }
 async estornar(empresaId:number,tipo:TipoConta,id:string,baixaId:string,motivo:string,operadorId:string){
  if(!motivo.trim())throw new BadRequestException('Informe o motivo.');
  return this.prisma.$transaction(async tx=>{
   const c=await this.conta(tx,empresaId,tipo,id),link=tipo==='pagar'?{contaPagarId:id}:{contaReceberId:id};
   const b=await tx.baixaFinanceira.findFirst({where:{id:baixaId,...link,estornoDeId:null}});
   if(!b||c.status==='CANCELADO'||await tx.baixaFinanceira.findUnique({where:{estornoDeId:baixaId}}))throw new BadRequestException('Baixa inexistente ou já estornada.');
   const novo=c.valorBaixado.minus(b.principal);if(novo.lt(0))throw new BadRequestException('Saldo inconsistente.');
   await this.atualizar(tx,empresaId,tipo,c,novo,'PENDENTE');
   await tx.baixaFinanceira.create({data:{...link,principal:b.principal.neg(),juros:b.juros.neg(),multa:b.multa.neg(),desconto:b.desconto.neg(),forma:b.forma,operadorId,observacao:motivo.trim(),estornoDeId:b.id}});
   return this.conta(tx,empresaId,tipo,id);
  });
 }
 async resumo(empresaId:number){
  const [p,r]=await Promise.all([this.prisma.contaPagar.findMany({where:{empresaId},select:{status:true,valor:true,valorBaixado:true}}),this.prisma.contaReceber.findMany({where:{empresaId},select:{status:true,valor:true,valorBaixado:true}})]);
  const agrupar=(cs:typeof p)=>Object.values(StatusConta).map(status=>{const linhas=cs.filter(c=>c.status===status);return {status,quantidade:linhas.length,valor:Number(linhas.reduce((a,c)=>a.plus(status==='PENDENTE'?c.valor.minus(c.valorBaixado):c.valor),dec(0)))};});
  const contasPagar=agrupar(p),contasReceber=agrupar(r);
  return {contasPagar,contasReceber,saldoPrevisto:Number(dec(contasReceber.find(c=>c.status==='PENDENTE')!.valor).minus(contasPagar.find(c=>c.status==='PENDENTE')!.valor))};
 }
 async referencias(empresaId:number){
  const [fornecedores,clientes,modulos]=await Promise.all([this.prisma.fornecedor.findMany({where:{empresaId},select:{id:true,razaoSocial:true},orderBy:{razaoSocial:'asc'}}),this.prisma.cliente.findMany({where:{empresaId,ativo:true},select:{id:true,nome:true,codigoCliente:true},orderBy:{nome:'asc'}}),consultarModulos(this.prisma,empresaId)]);
  const [fiados,delivery]=await Promise.all([modulos.FIADOS?this.prisma.cliente.aggregate({where:{empresaId},_sum:{saldoDevedor:true}}):null,modulos.ENTREGAS_DELIVERY?this.prisma.venda.findMany({where:{empresaId,status:'CONCLUIDA',tipoEntrega:'DELIVERY',statusAcerto:'PENDENTE'},select:{pagamentos:true}}):[]]);
  return {fornecedores,clientes,fiados:fiados?Number(fiados._sum.saldoDevedor??0):null,delivery:modulos.ENTREGAS_DELIVERY?Number(delivery.flatMap(v=>v.pagamentos).filter(p=>p.formaPagamento!=='FIADO').reduce((a,p)=>a.plus(p.valor.minus(p.troco)),dec(0))):null};
 }
}
