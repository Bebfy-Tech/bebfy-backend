import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoUnidadeMedida } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { PrismaService } from '../core/prisma/prisma.service';
type Tx=Prisma.TransactionClient;
export class UnidadeDto{
 @IsString() @Matches(/^[A-Za-z0-9]{1,6}$/) sigla:string;
 @IsString() @IsNotEmpty() @MaxLength(120) descricao:string;
 @IsEnum(TipoUnidadeMedida) tipo:TipoUnidadeMedida;
 @IsBoolean() ativo:boolean;
}
export const padroesUnidade:[string,string,TipoUnidadeMedida][]=[['UN','Unidade','CONTAGEM'],['CX','Caixa','EMBALAGEM'],['FD','Fardo','EMBALAGEM'],['PCT','Pacote','EMBALAGEM'],['ENG','Engradado','EMBALAGEM'],['KG','Quilograma','PESO'],['LT','Litro','VOLUME'],['ML','Mililitro','VOLUME']];
export async function inicializarUnidades(tx:Tx,empresaId:number){
 const lock=await tx.empresa.updateMany({where:{id:empresaId,unidadesInicializadas:false},data:{unidadesInicializadas:true}});
 if(lock.count)await tx.unidadeMedida.createMany({data:padroesUnidade.map(([sigla,descricao,tipo])=>({empresaId,sigla,descricao,tipo})),skipDuplicates:true});
}
export function normalizarSigla(s:string){const v=s.trim().toUpperCase();if(!/^[A-Z0-9]{1,6}$/.test(v))throw new BadRequestException('Sigla deve conter de 1 a 6 letras ou números.');return v;}
export async function unidadeAtiva(tx:Tx,empresaId:number,ref:{id:string}|{sigla:string},embalagem=false){
 const u=await tx.unidadeMedida.findFirst({where:{empresaId,ativo:true,...ref,...(embalagem?{tipo:'EMBALAGEM'}:{})}});
 if(!u)throw new BadRequestException('Unidade inexistente, inativa ou incompatível nesta empresa.');
 // Synchronize selection with inactivation and deletion.
 const r=await tx.unidadeMedida.updateMany({where:{id:u.id,empresaId,ativo:true,sigla:u.sigla,tipo:u.tipo},data:{ativo:true}});
 if(!r.count)throw new ConflictException('Unidade alterada durante a operação.');
 return u;
}
@Injectable()
export class UnidadesService{
 constructor(private readonly prisma:PrismaService){}
 private async serial<T>(f:(tx:Tx)=>Promise<T>){try{return await this.prisma.$transaction(f,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2003','P2034'].includes(e.code))throw new ConflictException('Sigla duplicada, unidade vinculada ou alteração concorrente. Atualize a lista.');throw e;}}
 async listar(empresaId:number){await this.prisma.$transaction(tx=>inicializarUnidades(tx,empresaId));return this.prisma.unidadeMedida.findMany({where:{empresaId},include:{_count:{select:{produtosBase:true,produtosEmbalagem:true}}},orderBy:{sigla:'asc'}});}
 private dados(d:UnidadeDto){if(!d.descricao.trim())throw new BadRequestException('Informe a descrição.');return {sigla:normalizarSigla(d.sigla),descricao:d.descricao.trim(),tipo:d.tipo,ativo:d.ativo};}
 async criar(empresaId:number,d:UnidadeDto){return this.serial(async tx=>{await inicializarUnidades(tx,empresaId);return tx.unidadeMedida.create({data:{empresaId,...this.dados(d)}});});}
 private async obter(tx:Tx,empresaId:number,id:string){const u=await tx.unidadeMedida.findFirst({where:{empresaId,id}});if(!u)throw new NotFoundException('Unidade não encontrada.');return u;}
 private usados(tx:Tx,empresaId:number,id:string,sigla:string){return tx.produto.count({where:{empresaId,OR:[{unidadeMedidaId:id},{unidadeEmbalagemId:id},{unidadeMedidaId:null,unidadeMedida:{equals:sigla,mode:'insensitive'}}]}});}
 async editar(empresaId:number,id:string,d:UnidadeDto){return this.serial(async tx=>{const u=await this.obter(tx,empresaId,id),dados=this.dados(d);if((u.sigla!==dados.sigla||u.tipo!==dados.tipo)&&await this.usados(tx,empresaId,id,u.sigla))throw new BadRequestException('Sigla e tipo de unidade utilizada não podem ser alterados. Cadastre outra unidade.');return tx.unidadeMedida.update({where:{id},data:dados});});}
 async situacao(empresaId:number,id:string,ativo:boolean){return this.serial(async tx=>{await this.obter(tx,empresaId,id);return tx.unidadeMedida.update({where:{id},data:{ativo}});});}
 async excluir(empresaId:number,id:string){return this.serial(async tx=>{const u=await this.obter(tx,empresaId,id);if(await this.usados(tx,empresaId,id,u.sigla))throw new BadRequestException('Unidade utilizada em produtos. Inative em vez de excluir.');await tx.unidadeMedida.delete({where:{id}});return {ok:true};});}
}
