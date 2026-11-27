import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { buscarFornecedorDocumento, documentoFornecedor } from './documento-fornecedor';
import { normalizarDocumento } from '../../varejo/clientes/documento';
type Tx=Prisma.TransactionClient;
const opcionais=['nomeFantasia','inscricaoEstadual','telefone','email','endereco','contatoComercial','cep','cidade','uf','segmento','observacao'] as const;
const pendente=(rows:{valor:Prisma.Decimal;valorBaixado:Prisma.Decimal}[])=>rows.reduce((n,c)=>n.plus(c.valor.minus(c.valorBaixado)),new Prisma.Decimal(0));
@Injectable()
export class FornecedoresService{
 constructor(private readonly prisma:PrismaService){}
 private async serial<T>(f:(tx:Tx)=>Promise<T>){try{return await this.prisma.$transaction(f,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2034'].includes(e.code))throw new ConflictException('Documento duplicado ou alteração concorrente. Atualize o cadastro.');throw e;}}
 private campos(dto:UpdateFornecedorDto){
  const d:Prisma.FornecedorUncheckedUpdateInput={};
  if(dto.razaoSocial!==undefined){if(!dto.razaoSocial?.trim())throw new BadRequestException('Informe o nome do fornecedor.');d.razaoSocial=dto.razaoSocial.trim();}
  for(const k of opcionais)if(dto[k]!==undefined)d[k]=dto[k]?.trim()||null;
  if(dto.cep)d.cep=dto.cep.replace(/\D/g,'');
  if(dto.ativo!==undefined){if(typeof dto.ativo!=='boolean')throw new BadRequestException('Situação inválida.');d.ativo=dto.ativo;}
  return d;
 }
 async create(empresaId:number,dto:CreateFornecedorDto){
  const tipoPessoa=dto.tipoPessoa??'JURIDICA',cnpj=documentoFornecedor(dto.cnpj,tipoPessoa);
  return this.serial(async tx=>{
   if(await buscarFornecedorDocumento(tx,empresaId,cnpj))throw new ConflictException('Já existe um fornecedor com este CPF/CNPJ.');
   if(!dto.razaoSocial?.trim())throw new BadRequestException('Informe o nome do fornecedor.');
   return tx.fornecedor.create({data:{empresaId,cnpj,tipoPessoa,razaoSocial:dto.razaoSocial.trim(),...Object.fromEntries(opcionais.map(k=>[k,dto[k]?.trim()||null])),cep:dto.cep?.replace(/\D/g,'')||null,ativo:dto.ativo??true}});
  });
 }
 async findAll(empresaId:number){return this.prisma.fornecedor.findMany({where:{empresaId,ativo:true},orderBy:{razaoSocial:'asc'}});}
 async findOne(empresaId:number,id:string){const f=await this.prisma.fornecedor.findFirst({where:{id,empresaId}});if(!f)throw new NotFoundException('Fornecedor não encontrado nesta empresa.');return f;}
 async gestao(empresaId:number,financeiro:boolean){
  const fornecedores=await this.prisma.fornecedor.findMany({where:{empresaId},orderBy:{razaoSocial:'asc'},include:{_count:{select:{notasFiscais:true}}}});
  if(!financeiro)return fornecedores.map(f=>({...f,saldoPendente:null,notasMes:null}));
  const now=new Date(Date.now()-3*3600000),inicio=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1,3)),fim=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1,3));
  const [p,n]=await Promise.all([this.prisma.contaPagar.findMany({where:{empresaId,status:'PENDENTE',fornecedorId:{not:null}},select:{fornecedorId:true,valor:true,valorBaixado:true}}),this.prisma.notaFiscal.groupBy({by:['fornecedorId'],where:{empresaId,dataEmissao:{gte:inicio,lt:fim}},_sum:{valorTotal:true}})]);
  const totais=new Map<string,Prisma.Decimal>();for(const c of p)totais.set(c.fornecedorId!, (totais.get(c.fornecedorId!)??new Prisma.Decimal(0)).plus(c.valor.minus(c.valorBaixado)));
  const notas=new Map(n.map(x=>[x.fornecedorId,x._sum.valorTotal]));
  return fornecedores.map(f=>({...f,saldoPendente:totais.get(f.id)??new Prisma.Decimal(0),notasMes:notas.get(f.id)??new Prisma.Decimal(0)}));
 }
 async ficha(empresaId:number,id:string,financeiro:boolean){
  const fornecedor=await this.findOne(empresaId,id);
  const notas=await this.prisma.notaFiscal.findMany({where:{empresaId,fornecedorId:id},orderBy:{dataEmissao:'desc'},take:100,select:{id:true,numeroNota:true,chaveAcesso:true,dataEmissao:true,criadoEm:true,valorTotal:true,itens:{select:{quantidade:true,valorUnitario:true,produto:{select:{id:true,nome:true}}}}}});
  if(!financeiro)return {fornecedor,notas,compras:null,contasPagar:null,saldoPendente:null};
  const compras=await this.prisma.compra.findMany({where:{empresaId,fornecedorId:id},orderBy:{criadoEm:'desc'},take:100,select:{id:true,codigoCompra:true,status:true,total:true,criadoEm:true,recebimentos:{where:{estornadoEm:null},select:{total:true}}}});
  const [contas,abertas]=await Promise.all([this.prisma.contaPagar.findMany({where:{empresaId,fornecedorId:id},orderBy:{dataVencimento:'desc'},take:100,select:{id:true,descricao:true,categoria:true,valor:true,valorBaixado:true,status:true,dataVencimento:true,notaFiscalId:true}}),this.prisma.contaPagar.findMany({where:{empresaId,fornecedorId:id,status:'PENDENTE'},select:{valor:true,valorBaixado:true}})]);
  return {fornecedor,notas,compras,contasPagar:contas,saldoPendente:pendente(abertas)};
 }
 async update(empresaId:number,id:string,dto:UpdateFornecedorDto){
  return this.serial(async tx=>{
   const old=await tx.fornecedor.findFirst({where:{id,empresaId}});if(!old)throw new NotFoundException('Fornecedor não encontrado.');
   const dados=this.campos(dto),tipo=dto.tipoPessoa??old.tipoPessoa;
   const alterado=dto.cnpj!==undefined&&normalizarDocumento(dto.cnpj)!==normalizarDocumento(old.cnpj)||tipo!==old.tipoPessoa;
   if(alterado){
    const doc=documentoFornecedor(dto.cnpj??old.cnpj,tipo);
    const [n,p]=await Promise.all([tx.notaFiscal.count({where:{fornecedorId:id}}),tx.contaPagar.count({where:{fornecedorId:id}})]);
    const compras=await tx.compra.count({where:{fornecedorId:id}});
    if(n||p||compras)throw new BadRequestException('Documento de fornecedor com histórico não pode ser alterado. Cadastre outro fornecedor.');
    const duplicado=await buscarFornecedorDocumento(tx,empresaId,doc);if(duplicado&&duplicado.id!==id)throw new ConflictException('Documento já cadastrado.');
    dados.cnpj=doc;dados.tipoPessoa=tipo;
   }
   return tx.fornecedor.update({where:{id},data:dados});
  });
 }
 async situacao(empresaId:number,id:string,ativo:boolean){
  const r=await this.prisma.fornecedor.updateMany({where:{id,empresaId},data:{ativo}});if(!r.count)throw new NotFoundException('Fornecedor não encontrado.');return {ok:true,ativo};
 }
 // Preserve identifiers and historical foreign keys even through the legacy DELETE route.
 async remove(empresaId:number,id:string){return this.situacao(empresaId,id,false);}
}
