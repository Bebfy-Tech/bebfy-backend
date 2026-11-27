import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracaoDto, exigirEditor, podeEditarConfiguracao } from './configuracoes-regras';
import { resolverModulos } from '../../common/modulos/plano-modulos';
const select={id:true,nomeFantasia:true,razaoSocial:true,cnpj:true,slug:true,subdominio:true,status:true,plano:{select:{nome:true,modulosPadrao:true}},modulosAtivos:{select:{modulo:true,ativo:true}},config:{select:{telefone:true,endereco:true,mensagemComprovante:true,obrigarCpfClienteVenda:true,atualizadoEm:true}}} as const;
type Dados=Prisma.EmpresaGetPayload<{select:typeof select}>;
function apresentar(e:Dados,cargo:string){
 return {empresa:{id:e.id,nomeFantasia:e.nomeFantasia,razaoSocial:e.razaoSocial,cnpj:e.cnpj,slug:e.subdominio||e.slug,status:e.status,plano:e.plano?.nome??null},config:{telefone:e.config?.telefone??'',endereco:e.config?.endereco??'',mensagemComprovante:e.config?.mensagemComprovante??'',obrigarCpfClienteVenda:e.config?.obrigarCpfClienteVenda??false,revisao:e.config?.atualizadoEm.toISOString()??null},modulos:resolverModulos(e),podeEditar:podeEditarConfiguracao(cargo)};
}
@Injectable()
export class ConfiguracoesService{
 constructor(private readonly prisma:PrismaService){}
 async operacao(empresaId:number){const c=await this.prisma.configGlobal.findUnique({where:{empresaId},select:{obrigarCpfClienteVenda:true}});return {obrigarCpfClienteVenda:c?.obrigarCpfClienteVenda??false};}
 async consultar(empresaId:number,cargo:string){
  if(!['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(cargo))throw new ForbiddenException('Configurações da empresa restritas a gestores.');
  const e=await this.prisma.empresa.findUnique({where:{id:empresaId},select});if(!e)throw new NotFoundException('Empresa não encontrada.');return apresentar(e,cargo);
 }
 async salvar(empresaId:number,usuarioId:string,dto:ConfiguracaoDto){
  try{return await this.prisma.$transaction(async tx=>{
   const u=await tx.usuario.findFirst({where:{id:usuarioId,ativo:true,primeiroAcesso:false,funcionario:{empresaId,ativo:true}},select:{funcionario:{select:{cargo:true}}}});
   exigirEditor(u?.funcionario.cargo);
   const e=await tx.empresa.findUnique({where:{id:empresaId},select});if(!e)throw new NotFoundException('Empresa não encontrada.');
   if((e.config?.atualizadoEm.toISOString()??null)!==dto.revisao)throw new ConflictException('Configuração alterada em outro acesso. Atualize antes de salvar.');
   const campos={telefone:dto.telefone||null,endereco:dto.endereco||null,mensagemComprovante:dto.mensagemComprovante||null,obrigarCpfClienteVenda:dto.obrigarCpfClienteVenda};
   await tx.configGlobal.upsert({where:{empresaId},create:{empresaId,nomeEmpresa:e.nomeFantasia,cnpj:e.cnpj,...campos},update:campos});
   await tx.logAuditoria.create({data:{empresaId,usuarioId,acao:'CONFIGURACOES_EMPRESA_EDITAR',entidade:'ConfigGlobal',entidadeId:String(empresaId),detalhes:JSON.stringify({campos:Object.keys(campos)})}});
   const novo=await tx.empresa.findUniqueOrThrow({where:{id:empresaId},select});
   return apresentar(novo,u!.funcionario.cargo);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
  catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&['P2002','P2034'].includes(e.code))throw new ConflictException('Configuração modificada simultaneamente. Atualize a tela.');throw e;}
 }
}
