import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoCadastroFinanceiro } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { CadastroFinanceiroDto } from './dto/cadastro-financeiro.dto';
import { inicializarCadastros, normalizarNome } from './cadastros-padroes';
type Tx=Prisma.TransactionClient;
@Injectable()
export class CadastrosFinanceirosService{
 constructor(private readonly prisma:PrismaService){}
 async listar(empresaId:number){
  await this.prisma.$transaction(tx=>inicializarCadastros(tx,empresaId));
  return this.prisma.cadastroFinanceiro.findMany({where:{empresaId},orderBy:[{tipo:'asc'},{nome:'asc'}]});
 }
 async auditoria(empresaId:number){return this.prisma.auditoriaCadastroFinanceiro.findMany({where:{empresaId},orderBy:{criadoEm:'desc'},take:200});}
 private async obter(tx:Tx,empresaId:number,id:string){
  const c=await tx.cadastroFinanceiro.findFirst({where:{empresaId,id}});if(!c)throw new NotFoundException('Cadastro não encontrado.');return c;
 }
 private async vinculo(tx:Tx,empresaId:number,id:string|null|undefined,tipo:TipoCadastroFinanceiro){
  if(!id)return null;
  const c=await tx.cadastroFinanceiro.findFirst({where:{empresaId,id,tipo,ativo:true}});if(!c)throw new BadRequestException('Vínculo inativo ou não pertence à empresa.');return c.id;
 }
 private async auditar(tx:Tx,empresaId:number,cadastroId:string,operadorId:string,acao:string,antes?:unknown,depois?:unknown){
  // Financial identifiers are excluded from the audit payload.
  const seguro=(v:unknown)=>{if(!v)return Prisma.JsonNull;const o=JSON.parse(JSON.stringify(v));delete o.chavePix;delete o.numeroConta;delete o.agencia;return o;};
  await tx.auditoriaCadastroFinanceiro.create({data:{empresaId,cadastroId,operadorId,acao,antes:seguro(antes),depois:seguro(depois)}});
 }
 private async dados(tx:Tx,empresaId:number,dto:CadastroFinanceiroDto){
  const nome=dto.nome.trim();if(!nome)throw new BadRequestException('Informe a descrição.');
  const forma=dto.tipo==='FORMA_PAGAMENTO',conta=dto.tipo==='CONTA',fiado=forma&&!!dto.fiado;
  const base=forma&&!fiado?dto.formaBase:null;
  if(forma&&!fiado&&(!base||base==='NAO_INFORMADO'))throw new BadRequestException('Informe o tipo de pagamento.');
  const cartao=base==='CARTAO_CREDITO'||base==='CARTAO_DEBITO',max=base==='CARTAO_CREDITO'?dto.maxParcelas??1:1;
  const taxas=cartao?dto.taxas??[]:[];
  if(new Set(taxas.map(t=>t.parcelas)).size!==taxas.length||taxas.some(t=>t.parcelas>max))throw new BadRequestException('Taxas duplicadas ou fora do parcelamento máximo.');
  if(forma&&dto.permitePdv&&!fiado&&!['DINHEIRO','PIX','CARTAO_CREDITO','CARTAO_DEBITO'].includes(base??''))throw new BadRequestException('Forma não suportada no PDV.');
  if(conta&&!dto.tipoConta)throw new BadRequestException('Informe o tipo da conta.');
  if(conta&&dto.tipoConta!=='CAIXA_FISICO'&&!dto.bancoId)throw new BadRequestException('Selecione o banco.');
  return {tipo:dto.tipo,nome,nomeNormalizado:normalizarNome(nome),ativo:dto.ativo??true,formaBase:base??null,fiado,permitePagar:forma&&!fiado&&!!dto.permitePagar,permiteReceber:forma&&!fiado&&!!dto.permiteReceber,permitePdv:forma&&!!dto.permitePdv,maxParcelas:max,taxas:taxas.map(t=>({parcelas:t.parcelas,taxa:t.taxa,prazoDias:t.prazoDias})),
    bancoId:conta&&dto.tipoConta!=='CAIXA_FISICO'?await this.vinculo(tx,empresaId,dto.bancoId,'BANCO'):null,
    contaId:forma&&!fiado?await this.vinculo(tx,empresaId,dto.contaId,'CONTA'):null,
    operadoraId:cartao?await this.vinculo(tx,empresaId,dto.operadoraId,'OPERADORA'):null,
    agencia:conta?dto.agencia?.trim()||null:null,numeroConta:conta?dto.numeroConta?.trim()||null:null,tipoConta:conta?dto.tipoConta:null,chavePix:conta?dto.chavePix?.trim()||null:null,saldoInicial:conta?dto.saldoInicial??0:0};
 }
 private async usados(tx:Tx,id:string){
  const [p,r,b,bc]=await Promise.all([tx.contaPagar.count({where:{categoriaCadastroId:id}}),tx.contaReceber.count({where:{categoriaCadastroId:id}}),tx.baixaFinanceira.count({where:{formaCadastroId:id}}),tx.baixaFinanceira.count({where:{contaFinanceiraId:id}})]);
  const [v,f]=await Promise.all([tx.pagamentoVenda.count({where:{OR:[{formaCadastroId:id},{contaFinanceiraId:id},{operadoraCadastroId:id}]}}),tx.historicoFiado.count({where:{OR:[{formaCadastroId:id},{contaFinanceiraId:id},{operadoraCadastroId:id}]}})]);
  const m=await tx.movimentoFinanceiro.count({where:{OR:[{origemId:id},{destinoId:id}]}});
  return p+r+b+bc+v+f+m>0;
 }
 private async dependentes(tx:Tx,empresaId:number,id:string,ativos:boolean){return tx.cadastroFinanceiro.count({where:{empresaId,...(ativos?{ativo:true}:{}),OR:[{bancoId:id},{contaId:id},{operadoraId:id}]}});}
 private conflito(e:unknown):never{if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2003'].includes(e.code))throw new ConflictException('Nome já cadastrado ou registro vinculado.');throw e;}
 async criar(empresaId:number,dto:CadastroFinanceiroDto,operadorId:string){
  try{return await this.prisma.$transaction(async tx=>{await inicializarCadastros(tx,empresaId);const c=await tx.cadastroFinanceiro.create({data:{empresaId,...await this.dados(tx,empresaId,dto)}});await this.auditar(tx,empresaId,c.id,operadorId,'CRIAR',null,c);return c;});}catch(e){this.conflito(e);}
 }
 async editar(empresaId:number,id:string,dto:CadastroFinanceiroDto,operadorId:string){
  try{return await this.prisma.$transaction(async tx=>{
   const old=await this.obter(tx,empresaId,id);
   if(old.tipo!==dto.tipo)throw new BadRequestException('O grupo do cadastro não pode ser alterado.');
   const data=await this.dados(tx,empresaId,dto);
   if(old.tipo==='CONTA'&&!old.saldoInicial.equals(data.saldoInicial)&&await this.usados(tx,id))throw new BadRequestException('Saldo inicial não pode ser alterado após movimentações ou vínculos de pagamento.');
   if(await this.usados(tx,id)&&(old.formaBase!==data.formaBase||old.fiado!==data.fiado))throw new BadRequestException('Tipo de pagamento já utilizado. Cadastre uma nova opção.');
   if(!data.ativo&&await this.dependentes(tx,empresaId,id,true))throw new BadRequestException('Inative os cadastros dependentes primeiro.');
   const c=await tx.cadastroFinanceiro.update({where:{id},data});await this.auditar(tx,empresaId,id,operadorId,'EDITAR',old,c);return c;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){this.conflito(e);}
 }
 async situacao(empresaId:number,id:string,ativo:boolean,operadorId:string){
  return this.prisma.$transaction(async tx=>{
   const old=await this.obter(tx,empresaId,id);
   if(!ativo&&await this.dependentes(tx,empresaId,id,true))throw new BadRequestException('Inative os cadastros dependentes primeiro.');
   if(ativo){await this.vinculo(tx,empresaId,old.bancoId,'BANCO');await this.vinculo(tx,empresaId,old.contaId,'CONTA');await this.vinculo(tx,empresaId,old.operadoraId,'OPERADORA');}
   const c=await tx.cadastroFinanceiro.update({where:{id},data:{ativo}});await this.auditar(tx,empresaId,id,operadorId,ativo?'ATIVAR':'INATIVAR',old,c);return c;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
 async excluir(empresaId:number,id:string,operadorId:string){
  try{return await this.prisma.$transaction(async tx=>{
   const old=await this.obter(tx,empresaId,id);
   if(await this.usados(tx,id)||await this.dependentes(tx,empresaId,id,false))throw new BadRequestException('Cadastro vinculado a operações. Inative em vez de excluir.');
   await tx.cadastroFinanceiro.delete({where:{id}});await this.auditar(tx,empresaId,id,operadorId,'EXCLUIR',old);return {ok:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){this.conflito(e);}
 }
}
