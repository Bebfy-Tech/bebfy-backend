import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { ConfigurarAcessoDto } from './dto/configurar-acesso.dto';
import { AtorFuncionario, validarHierarquia, validarPermissoes, validarSenhaTemporaria, gestores } from './funcionarios-regras';
import * as bcrypt from 'bcrypt';

const usuarioSelect = { id: true, email: true, permissoes: true, ativo: true, primeiroAcesso: true, ultimaAtividadeEm: true, sessaoId: true } as const;
const incluir = { usuario: { select: usuarioSelect } } as const;
type Ficha = Prisma.FuncionarioGetPayload<{include: typeof incluir}>;
// Nunca devolver hash, identificador de sessão ou token ao painel.
function publico(f: Ficha) {
  const u = f.usuario;
  if (!u) return { ...f, usuario: null };
  const { sessaoId, ...dados } = u;
  return { ...f, usuario: { ...dados, sessaoAtiva: Boolean(sessaoId && u.ativo && f.ativo && !u.primeiroAcesso), atividadeRecente: Boolean(sessaoId && u.ultimaAtividadeEm && Date.now()-u.ultimaAtividadeEm.getTime()<120000 && u.ativo && f.ativo && !u.primeiroAcesso) } };
}

@Injectable()
export class FuncionariosService {
  constructor(private readonly prisma: PrismaService) {}

  private async transacao<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch(e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(e.code))
        throw new ConflictException('Cadastro duplicado ou operação concorrente. Atualize a tela e tente novamente.');
      throw e;
    }
  }
  private async ator(tx: Prisma.TransactionClient, empresaId: number, ator: AtorFuncionario) {
    const u=await tx.usuario.findFirst({where:{id:ator.id,funcionarioId:ator.funcionarioId,ativo:true,primeiroAcesso:false,funcionario:{empresaId,ativo:true}},include:{funcionario:true}});
    if(!u || !gestores.includes(u.funcionario.cargo)) throw new ForbiddenException('Apenas gestores ativos podem administrar funcionários.');
    return u.funcionario;
  }
  private async alvo(tx: Prisma.TransactionClient, empresaId: number, id: string, ator: AtorFuncionario) {
    const gestor=await this.ator(tx,empresaId,ator);
    const f=await tx.funcionario.findFirst({where:{id,empresaId},include:incluir});
    if(!f)throw new NotFoundException('Funcionário não encontrado nesta empresa.');
    validarHierarquia(gestor.cargo,f.cargo);
    return {gestor,f};
  }
  private protegerProprio(id: string, ator: AtorFuncionario) {
    if(id===ator.funcionarioId)throw new ForbiddenException('Não é permitido alterar o próprio acesso, cargo ou situação por esta área.');
  }
  private async protegerProprietario(tx: Prisma.TransactionClient, f: Ficha, empresaId: number) {
    if(f.cargo!=='PROPRIETARIO'||!f.ativo||!f.usuario?.ativo)return;
    const outros=await tx.funcionario.count({where:{empresaId,id:{not:f.id},cargo:'PROPRIETARIO',ativo:true,usuario:{is:{ativo:true}}}});
    if(!outros)throw new ConflictException('Mantenha ao menos um proprietário ativo com acesso.');
  }
  private audit(tx: Prisma.TransactionClient, empresaId: number, ator: AtorFuncionario, id: string, acao: string) {
    return tx.logAuditoria.create({data:{empresaId,usuarioId:ator.id,acao,entidade:'Funcionario',entidadeId:id}});
  }
  private limparCpf(cpf: string) {
    const v=cpf.replace(/\D/g,'');if(v.length!==11)throw new BadRequestException('Informe um CPF com 11 dígitos.');return v;
  }

  async create(dto: CreateFuncionarioDto, empresaId: number, ator: AtorFuncionario) {
    return this.transacao(async tx=>{
      const gestor=await this.ator(tx,empresaId,ator);
      validarHierarquia(gestor.cargo,dto.cargo);
      const cpf=this.limparCpf(dto.cpf),nome=dto.nome.trim();
      if(!nome)throw new BadRequestException('Informe o nome.');
      if(await tx.funcionario.findFirst({where:{empresaId,cpf}}))throw new ConflictException('CPF já cadastrado nesta empresa.');
      const f=await tx.funcionario.create({data:{...dto,nome,cpf,empresaId}});
      await this.audit(tx,empresaId,ator,f.id,'FUNCIONARIO_CRIAR');return f;
    });
  }
  async findAll(empresaId: number) {
    return (await this.prisma.funcionario.findMany({where:{empresaId},include:incluir,orderBy:{criadoEm:'desc'}})).map(publico);
  }
  async findOne(id: string, empresaId: number) {
    const f=await this.prisma.funcionario.findFirst({where:{id,empresaId},include:incluir});
    if(!f)throw new NotFoundException('Funcionário não encontrado nesta empresa.');return publico(f);
  }
  async update(id: string, dto: UpdateFuncionarioDto, empresaId: number, ator: AtorFuncionario) {
    return this.transacao(async tx=>{
      const {gestor,f}=await this.alvo(tx,empresaId,id,ator);
      if(dto.cargo)validarHierarquia(gestor.cargo,dto.cargo);
      const mudaCargo=dto.cargo!==undefined&&dto.cargo!==f.cargo;
      const mudaSituacao=dto.ativo!==undefined&&dto.ativo!==f.ativo;
      if(mudaCargo||mudaSituacao)this.protegerProprio(id,ator);
      if((mudaCargo&&dto.cargo!=='PROPRIETARIO')||dto.ativo===false)await this.protegerProprietario(tx,f,empresaId);
      const dados={...dto,...(dto.cpf!==undefined?{cpf:this.limparCpf(dto.cpf)}:{}),...(dto.nome!==undefined?{nome:dto.nome.trim()}:{} )};
      if(dados.nome!==undefined&&!dados.nome)throw new BadRequestException('Informe o nome.');
      const atualizado=await tx.funcionario.update({where:{id},data:dados});
      if(mudaCargo||mudaSituacao)await tx.usuario.updateMany({where:{funcionarioId:id},data:{sessaoId:null,ultimaAtividadeEm:null,...(dto.ativo===false?{ativo:false}:{})}});
      await this.audit(tx,empresaId,ator,id,'FUNCIONARIO_EDITAR');return atualizado;
    });
  }
  async configurarAcesso(id: string, empresaId: number, dto: ConfigurarAcessoDto, ator: AtorFuncionario) {
    this.protegerProprio(id,ator);
    validarSenhaTemporaria(dto.senha);const permissoes=validarPermissoes(dto.permissoes);
    const email=dto.email.toLowerCase().trim();const hash=await bcrypt.hash(dto.senha,12);
    return this.transacao(async tx=>{
      const {f}=await this.alvo(tx,empresaId,id,ator);
      if(!f.ativo)throw new ConflictException('Funcionário inativo.');
      if(await tx.usuario.findFirst({where:{email,NOT:{funcionarioId:id}}}))throw new ConflictException('E-mail de acesso já utilizado.');
      if(dto.codigo!=null) {
        if(await tx.funcionario.findFirst({where:{empresaId,codigo:dto.codigo,NOT:{id}}}))throw new ConflictException('Código de operador já utilizado.');
        await tx.funcionario.update({where:{id},data:{codigo:dto.codigo}});
      }
      const u=await tx.usuario.upsert({where:{funcionarioId:id},create:{funcionarioId:id,email,senha:hash,primeiroAcesso:true,permissoes,ativo:true},update:{email,senha:hash,primeiroAcesso:true,sessaoId:null,ultimaAtividadeEm:null,permissoes,ativo:true},select:{id:true,email:true,ativo:true,permissoes:true,primeiroAcesso:true}});
      await tx.resetSenhaToken.updateMany({where:{usuarioId:u.id,usadoEm:null},data:{usadoEm:new Date()}});
      await this.audit(tx,empresaId,ator,id,'FUNCIONARIO_CONFIGURAR_ACESSO');return u;
    });
  }
  async permissoes(id: string, empresaId: number, valores: string[], ator: AtorFuncionario) {
    this.protegerProprio(id,ator);const permissoes=validarPermissoes(valores);
    return this.transacao(async tx=>{
      const {f}=await this.alvo(tx,empresaId,id,ator);
      if(!f.usuario)throw new ConflictException('Configure o acesso primeiro.');
      if(gestores.includes(f.cargo))throw new BadRequestException('Gestores possuem acesso administrativo por cargo.');
      await tx.usuario.update({where:{id:f.usuario.id},data:{permissoes,sessaoId:null,ultimaAtividadeEm:null}});
      await this.audit(tx,empresaId,ator,id,'FUNCIONARIO_PERMISSOES');return {ok:true};
    });
  }
  async situacaoAcesso(id: string, empresaId: number, ativo: boolean, ator: AtorFuncionario) {
    this.protegerProprio(id,ator);
    return this.transacao(async tx=>{
      const {f}=await this.alvo(tx,empresaId,id,ator);
      if(!f.usuario||(!f.ativo&&ativo))throw new ConflictException('Funcionário sem acesso ou inativo.');
      if(!ativo)await this.protegerProprietario(tx,f,empresaId);
      await tx.usuario.update({where:{id:f.usuario.id},data:{ativo,sessaoId:null,ultimaAtividadeEm:null}});
      if(!ativo)await tx.resetSenhaToken.updateMany({where:{usuarioId:f.usuario.id,usadoEm:null},data:{usadoEm:new Date()}});
      await this.audit(tx,empresaId,ator,id,ativo?'FUNCIONARIO_LIBERAR_ACESSO':'FUNCIONARIO_BLOQUEAR_ACESSO');return {ok:true};
    });
  }
  async revogarSessao(id: string, empresaId: number, ator: AtorFuncionario) {
    this.protegerProprio(id,ator);
    return this.transacao(async tx=>{
      const {f}=await this.alvo(tx,empresaId,id,ator);
      if(!f.usuario)throw new ConflictException('Funcionário sem acesso.');
      await tx.usuario.update({where:{id:f.usuario.id},data:{sessaoId:null,ultimaAtividadeEm:null}});
      await this.audit(tx,empresaId,ator,id,'FUNCIONARIO_REVOGAR_SESSAO');return {ok:true};
    });
  }
  async remove(id: string, empresaId: number, ator: AtorFuncionario) {
    return this.update(id,{ativo:false},empresaId,ator);
  }
}
