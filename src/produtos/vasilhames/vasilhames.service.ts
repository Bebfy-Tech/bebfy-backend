import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { OrigemCasco, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CriarMovimentacaoCascoDto } from './dto/criar-movimentacao-casco.dto';
import { aplicarCasco, saldoLegado } from './saldos';
@Injectable()
export class VasilhamesService {
 constructor(private readonly prisma:PrismaService){}
 async tipos(empresaId:number){return this.prisma.tipoVasilhame.findMany({where:{empresaId},orderBy:{nome:'asc'}});}
 async criarTipo(empresaId:number,nome:string){
  nome=nome.trim();if(!nome)throw new BadRequestException('Informe o nome do tipo.');
  try{return await this.prisma.tipoVasilhame.create({data:{empresaId,nome}});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')throw new ConflictException('Tipo já cadastrado.');throw e;}
 }
 async associar(empresaId:number,produtoId:number,tipoVasilhameId:number){
  if(!await this.prisma.tipoVasilhame.findFirst({where:{id:tipoVasilhameId,empresaId}}))throw new NotFoundException('Tipo não encontrado.');
  const r=await this.prisma.produto.updateMany({where:{id:produtoId,empresaId,ativo:true,retornavel:true},data:{tipoVasilhameId}});
  if(r.count!==1)throw new BadRequestException('Produto retornável não encontrado.');
  return {ok:true};
 }
 async registrarMovimentacao(dto:CriarMovimentacaoCascoDto,empresaId:number){
  return this.prisma.$transaction(async tx=>{
   const r=await tx.cliente.updateMany({where:{id:dto.clienteId,empresaId,ativo:true},data:{ativo:true}});
   if(r.count!==1)throw new NotFoundException('Cliente indisponível.');
   let tipoId=dto.tipoVasilhameId??null;
   if(dto.produtoId){
    const p=await tx.produto.findFirst({where:{id:dto.produtoId,empresaId,ativo:true,retornavel:true}});
    if(!p?.tipoVasilhameId)throw new BadRequestException('Associe o produto retornável a um tipo de vasilhame.');
    if(tipoId!==null&&tipoId!==p.tipoVasilhameId)throw new BadRequestException('Tipo incompatível com o produto.');
    tipoId=p.tipoVasilhameId;
   }
   if(tipoId!==null&&!await tx.tipoVasilhame.findFirst({where:{id:tipoId,empresaId}}))throw new NotFoundException('Tipo não encontrado.');
   if(dto.tipo==='EMPRESTIMO_SAIDA'&&tipoId===null)throw new BadRequestException('Selecione um tipo para o empréstimo.');
   if((dto.tipo==='QUEBRA_AVARIA'||dto.tipo==='CLASSIFICACAO')&&!dto.observacao?.trim())throw new BadRequestException('Informe o motivo.');
   const quantidade=dto.tipo==='EMPRESTIMO_SAIDA'||dto.tipo==='CLASSIFICACAO'?dto.quantidade:-dto.quantidade;
   if(dto.chaveOperacao){
    const anterior=await tx.movimentacaoCasco.findFirst({where:{empresaId,clienteId:dto.clienteId,chaveOperacao:dto.chaveOperacao}});
    if(anterior){if(anterior.quantidade!==quantidade||anterior.tipoVasilhameId!==tipoId||anterior.origem!==dto.tipo||anterior.produtoId!==(dto.produtoId??null)||anterior.observacao!==(dto.observacao??null))throw new ConflictException('Chave já utilizada com dados diferentes.');return {mensagem:'Movimentação já registrada.',movimentacao:anterior};}
   }
   const movimentacao=await aplicarCasco(tx,empresaId,dto.clienteId,{tipoVasilhameId:tipoId,produtoId:dto.produtoId,quantidade,origem:dto.tipo as OrigemCasco,observacao:dto.observacao,chaveOperacao:dto.chaveOperacao});
   return {mensagem:'Movimentação de vasilhame registrada.',movimentacao};
  });
 }
 async listarExtratoCliente(clienteId:string,empresaId:number){
  return this.prisma.$transaction(async tx=>{
   const cliente=await tx.cliente.findFirst({where:{id:clienteId,empresaId},select:{id:true,nome:true,codigoCliente:true,cascosEmPosse:true,ativo:true}});
   if(!cliente)throw new NotFoundException('Cliente não encontrado.');
   const historico=await tx.movimentacaoCasco.findMany({where:{empresaId,clienteId},include:{produto:{select:{id:true,nome:true}},tipoVasilhame:{select:{id:true,nome:true}}},orderBy:{criadoEm:'desc'}});
   const tipos=await tx.tipoVasilhame.findMany({where:{empresaId},select:{id:true,nome:true}});
   const saldos=tipos.map(t=>({...t,quantidade:historico.filter(m=>m.tipoVasilhameId===t.id).reduce((a,m)=>a+m.quantidade,0)})).filter(t=>t.quantidade!==0);
   return {cliente,historico,saldos,legado:saldoLegado(cliente.cascosEmPosse,saldos.map(t=>t.quantidade))};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async historico(empresaId:number){
  return this.prisma.movimentacaoCasco.findMany({where:{empresaId},include:{cliente:{select:{id:true,nome:true,codigoCliente:true}},produto:{select:{id:true,nome:true}},tipoVasilhame:{select:{id:true,nome:true}}},orderBy:{criadoEm:'desc'}});
 }
}
