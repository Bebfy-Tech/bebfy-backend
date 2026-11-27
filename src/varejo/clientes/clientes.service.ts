import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusVenda, TipoPessoa } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { consultarModulos } from '../../common/modulos/plano-modulos';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { normalizarDocumento, validarDocumento } from './documento';
import { configurarCredito } from './credito';

@Injectable()
export class ClientesService {
 constructor(private readonly prisma:PrismaService){}
 private async dados(empresaId:number,dto:UpdateClienteDto,id?:string){
  const data={...dto,...configurarCredito(dto.modalidadeCredito,dto.limiteCredito)};
  if(data.nome!==undefined){data.nome=data.nome.trim();if(!data.nome)throw new BadRequestException('Informe o nome do cliente.');}
  // Only normalize a changed document; legacy data can still be viewed and corrected.
  if(data.cpfCnpj!==undefined){
   const doc=validarDocumento(data.cpfCnpj);data.cpfCnpj=doc;
   if(doc){
    const tipo=doc.length===11?TipoPessoa.FISICA:TipoPessoa.JURIDICA;
    if(data.tipoPessoa&&data.tipoPessoa!==tipo)throw new BadRequestException('Documento incompatível com o tipo de pessoa.');
    data.tipoPessoa=tipo;
    // Compare canonical forms to detect legacy masked documents as well.
    const outros=await this.prisma.cliente.findMany({where:{empresaId,cpfCnpj:{not:null},...(id?{id:{not:id}}:{})},select:{cpfCnpj:true}});
    if(outros.some(c=>normalizarDocumento(c.cpfCnpj)===doc))throw new ConflictException('Já existe um cliente com este CPF/CNPJ nesta empresa.');
   }
  }
  return data;
 }
 private tratar(e:unknown):never{if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')throw new ConflictException('Já existe um cliente com este CPF/CNPJ nesta empresa.');throw e;}
 async create(empresaId:number,dto:CreateClienteDto){
  const data=await this.dados(empresaId,dto);
  try{return await this.prisma.cliente.create({data:{...data,nome:data.nome!,empresaId}});}catch(e){this.tratar(e);}
 }
 async findAll(empresaId:number){
  return this.prisma.cliente.findMany({where:{empresaId},include:{_count:{select:{vendas:true,fiados:true}}},orderBy:{criadoEm:'desc'}});
 }
 async findOne(empresaId:number,id:string){
  const c=await this.prisma.cliente.findFirst({where:{id,empresaId},include:{fiados:{take:5,orderBy:{criadoEm:'desc'}}}});
  if(!c)throw new NotFoundException('Cliente não encontrado nesta empresa.');
  return c;
 }
 async ficha(empresaId:number,id:string){
  const cliente=await this.prisma.cliente.findFirst({where:{id,empresaId}});
  if(!cliente)throw new NotFoundException('Cliente não encontrado nesta empresa.');
  const modulos=await consultarModulos(this.prisma,empresaId);
  const [resumo,vendas,fiados,vasilhames]=await Promise.all([
   modulos.CAIXA_PDV?this.prisma.venda.aggregate({where:{empresaId,clienteId:id,status:StatusVenda.CONCLUIDA},_sum:{valorTotal:true},_count:{id:true}}):null,
   modulos.CAIXA_PDV?this.prisma.venda.findMany({where:{empresaId,clienteId:id},orderBy:{criadoEm:'desc'},take:100,select:{id:true,codigoVenda:true,criadoEm:true,status:true,valorTotal:true,pagamentos:{select:{formaPagamento:true}}}}):[],
   modulos.FIADOS?this.prisma.historicoFiado.findMany({where:{clienteId:id,cliente:{empresaId}},orderBy:{criadoEm:'desc'},take:100}):[],
   modulos.VASILHAMES_RETORNAVEIS?this.prisma.movimentacaoCasco.findMany({where:{empresaId,clienteId:id},orderBy:{criadoEm:'desc'},take:100,include:{produto:{select:{nome:true}}}}):[],
  ]);
  return {cliente,totalCompras:Number(resumo?._sum.valorTotal??0),quantidadeCompras:resumo?._count.id??0,vendas,fiados,vasilhames};
 }
 async update(empresaId:number,id:string,dto:UpdateClienteDto){
  const atual=await this.findOne(empresaId,id);
  const data=await this.dados(empresaId,dto,id);
  if(data.tipoPessoa&&data.cpfCnpj===undefined&&atual.cpfCnpj){
   const doc=normalizarDocumento(atual.cpfCnpj);
   if((doc.length===11&&data.tipoPessoa!==TipoPessoa.FISICA)||(doc.length===14&&data.tipoPessoa!==TipoPessoa.JURIDICA))throw new BadRequestException('Atualize o documento para alterar o tipo de pessoa.');
  }
  try{return await this.prisma.cliente.update({where:{id,empresaId},data});}catch(e){this.tratar(e);}
 }
 async situacao(empresaId:number,id:string,ativo:boolean){
  // Inactivation is blocked while debts or returnables need settlement.
  const result=await this.prisma.cliente.updateMany({where:{id,empresaId,...(!ativo?{saldoDevedor:0,cascosEmPosse:0}:{})},data:{ativo}});
  if(result.count!==1){
   await this.findOne(empresaId,id);
   throw new BadRequestException('Quite o fiado e regularize os vasilhames antes de inativar este cliente.');
  }
  return this.findOne(empresaId,id);
 }
 /** Legacy DELETE is now safe inactivation; never erase historical relationships. */
 async remove(empresaId:number,id:string){return this.situacao(empresaId,id,false);}
}
