import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Prisma, SaasCargo } from '@prisma/client';

export const SAAS_PERMISSIONS = ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS', 'SUPORTE'] as const;
export type SaasPermission = typeof SAAS_PERMISSIONS[number];

@Injectable()
export class SaasAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private publicUser(user: { id: string; codigo: number; nome: string; email?: string | null; cargo: SaasCargo; permissoes: string[]; ativo: boolean }) {
    return { id: user.id, codigo: user.codigo, nome: user.nome, email: user.email, cargo: user.cargo, permissoes: user.permissoes, ativo: user.ativo };
  }

  async login(codigo: number, senha: string) {
    if(!Number.isInteger(codigo)||codigo<1||codigo>2147483647||typeof senha!=='string'||!senha||Buffer.byteLength(senha,'utf8')>72)throw new UnauthorizedException('Login ou senha incorretos.');
    const user = await this.prisma.saasOperador.findUnique({ where: { codigo } });
    if (!user || !user.ativo || !await bcrypt.compare(senha, user.senha)) {
      throw new UnauthorizedException('Login ou senha incorretos.');
    }
    const sessaoId = randomUUID();
    // Never install a new session using a credential or account changed during bcrypt verification.
    const claimed=await this.prisma.saasOperador.updateMany({where:{id:user.id,codigo,ativo:true,senha:user.senha},data:{sessaoId}});
    if(claimed.count!==1)throw new UnauthorizedException('Login ou senha incorretos.');
    return {
      access_token: await this.jwt.signAsync({ sub: user.id, tipo: 'SAAS_ADMIN', sessaoId }, { expiresIn: '8h' }),
      usuario: this.publicUser(user),
    };
  }

  async sair(id: string, sessaoId: string) {
    await this.prisma.saasOperador.updateMany({ where: { id, sessaoId }, data: { sessaoId: null } });
    return { encerrada: true };
  }

  async listar() {
    const users = await this.prisma.saasOperador.findMany({
      select: { id: true, codigo: true, nome: true, cargo: true, permissoes: true, ativo: true, email: true, criadoEm: true, atualizadoEm: true },
      orderBy: { codigo: 'asc' },
    });
    return users;
  }

  private validarSenha(senha:string) {
    // bcrypt truncates inputs above 72 bytes. Reject instead of silently truncating.
    if(typeof senha!=='string'||senha.length<12||!senha.trim()||Buffer.byteLength(senha,'utf8')>72)throw new BadRequestException('A senha deve conter ao menos 12 caracteres e no máximo 72 bytes.');
  }

  private validarCodigo(codigo:number) {
    if(!Number.isInteger(codigo)||codigo<3||codigo>2147483647)throw new BadRequestException('Informe um código de operador entre 3 e 2147483647. Os códigos 1 e 2 são reservados.');
  }

  private async ator(id:string) {
    const actor=await this.prisma.saasOperador.findUnique({where:{id}});
    if(!actor?.ativo)throw new UnauthorizedException('Sessão administrativa inválida.');
    if(actor.cargo!==SaasCargo.SUPER_ADMIN&&!actor.permissoes.includes('FUNCIONARIOS'))throw new ForbiddenException('Sem permissão para administrar a equipe.');
    return actor;
  }

  private podeDelegar(actor:{cargo:SaasCargo;permissoes:string[]},permissions:string[]) {
    if(actor.cargo!==SaasCargo.SUPER_ADMIN&&permissions.some(p=>p==='FUNCIONARIOS'||!actor.permissoes.includes(p)))throw new ForbiddenException('Somente superadministradores podem administrar gestores da equipe ou conceder permissões fora do seu próprio acesso.');
  }

  private async gravar<T>(task:()=>Promise<T>):Promise<T> {
    try{return await task();}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2002')throw new ConflictException('Código ou e-mail já cadastrado.');throw e;}
  }

  async criar(input: { codigo: number; nome: string; email?:string|null; senha: string; cargo: SaasCargo; permissoes: string[] },operadorId:string) {
    const actor=await this.ator(operadorId);
    this.validarCodigo(input.codigo);
    if(input.nome.trim().length<2)throw new BadRequestException('Nome inválido.');
    this.validarSenha(input.senha);
    this.podeDelegar(actor,input.permissoes);

    if (input.permissoes.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) {
      throw new BadRequestException('Permissão inválida.');
    }
    if (input.cargo === SaasCargo.SUPER_ADMIN) throw new ForbiddenException('Outros superadministradores só podem ser provisionados localmente.');
    const duplicate = await this.prisma.saasOperador.findUnique({ where: { codigo: input.codigo } });
    if (duplicate) throw new ConflictException('Código de acesso já cadastrado.');
    const senha = await bcrypt.hash(input.senha, 12);
    const user = await this.gravar(()=>this.prisma.saasOperador.create({
      data: { codigo: input.codigo, nome: input.nome.trim(), email:input.email?.trim().toLowerCase()||null, senha, cargo: input.cargo, permissoes: [...new Set(input.permissoes)] },
    }));
    return this.publicUser(user);
  }

  async atualizarPerfil(id:string,input:{nome?:string;email?:string|null;senhaAtual?:string;novaSenha?:string},sessaoId:string){
    const existente=await this.prisma.saasOperador.findUnique({where:{id}});
    if(!existente?.ativo||!sessaoId||existente.sessaoId!==sessaoId)throw new UnauthorizedException('Sessão inválida.');
    if(input.nome!==undefined&&(typeof input.nome!=='string'||input.nome.trim().length<2))throw new BadRequestException('Nome inválido.');
    if(input.novaSenha!==undefined){
      this.validarSenha(input.novaSenha);
      if(typeof input.senhaAtual!=='string'||Buffer.byteLength(input.senhaAtual,'utf8')>72||!await bcrypt.compare(input.senhaAtual,existente.senha))throw new BadRequestException('Senha atual incorreta.');
      if(await bcrypt.compare(input.novaSenha,existente.senha))throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }
    if(input.nome===undefined&&input.email===undefined&&input.novaSenha===undefined)throw new BadRequestException('Nenhuma alteração informada.');
    const novaHash=input.novaSenha?await bcrypt.hash(input.novaSenha,12):undefined;
    try{
      // Atomic compare-and-set prevents a revoked session or concurrently reset credential from changing the profile.
      const atualizado=await this.gravar(()=>this.prisma.saasOperador.update({
        where:{id,ativo:true,sessaoId,senha:existente.senha},
        data:{
          ...(input.nome!==undefined?{nome:input.nome.trim()}:{}),
          ...(input.email!==undefined?{email:input.email?.trim().toLowerCase()||null}:{}),
          ...(novaHash?{senha:novaHash,sessaoId:null}:{}),
        },
      }));
      return this.publicUser(atualizado);
    }catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2025')throw new UnauthorizedException('Sessão administrativa revogada.');throw e;}
  }

  async atualizar(id: string, input: { codigo?: number; nome?: string; email?: string | null; senha?: string; senhaAtualAdmin?: string; permissoes?: string[]; ativo?: boolean }, operadorId: string) {
    const [existing, actor] = await Promise.all([
      this.prisma.saasOperador.findUnique({ where: { id } }),
      this.ator(operadorId),
    ]);
    if (!existing) throw new BadRequestException('Funcionário não encontrado.');
    if (!actor?.ativo) throw new UnauthorizedException('Sessão administrativa inválida.');
    if (input.permissoes?.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) {
      throw new BadRequestException('Permissão inválida.');
    }
    const nome = input.nome?.trim();
    if (input.nome !== undefined && (!nome || nome.length < 2)) {
      throw new BadRequestException('O nome precisa ter ao menos 2 caracteres.');
    }
    const email = input.email?.trim().toLowerCase();
    if (existing.cargo === SaasCargo.SUPER_ADMIN) {
      if (actor.cargo !== SaasCargo.SUPER_ADMIN) {
        throw new ForbiddenException('Apenas um superadministrador pode editar um superadministrador.');
      }
      // Preserve the two reserved identifiers and privileged, active accounts.
      if (existing.codigo !== 1 && existing.codigo !== 2) {
        throw new ForbiddenException('Este superadministrador exige atualização por provisionamento seguro.');
      }
      if (input.codigo !== undefined && input.codigo !== existing.codigo) {
        throw new BadRequestException('Os códigos principais 1 e 2 não podem ser alterados.');
      }
      if (input.ativo === false || input.permissoes !== undefined) {
        throw new ForbiddenException('Não é permitido desativar ou restringir os administradores principais.');
      }
      // Only the account holder can change their own password through Meu Perfil,
      // which verifies their current password and revokes the active session.
      if (input.senha !== undefined) {
        throw new ForbiddenException('A senha dos administradores principais deve ser alterada em Meu perfil.');
      }
      const user = await this.gravar(()=>this.prisma.saasOperador.update({
        where: { id },
        data: {
          ...(nome !== undefined ? { nome } : {}),
          ...(input.email !== undefined ? { email: email || null } : {}),
        },
      }));
      return this.publicUser(user);
    }
    // A delegated manager cannot reset a more privileged account or grant new privileges to themselves.
    this.podeDelegar(actor,existing.permissoes);
    if(input.permissoes)this.podeDelegar(actor,input.permissoes);
    if(id===operadorId&&(input.codigo!==undefined||input.ativo!==undefined||input.permissoes!==undefined||input.senha!==undefined))throw new ForbiddenException('Utilize Meu perfil para alterar suas próprias credenciais.');
    if(input.codigo!==undefined)this.validarCodigo(input.codigo);
    if(input.senha!==undefined)this.validarSenha(input.senha);
    const revogar=input.codigo!==undefined&&input.codigo!==existing.codigo||input.ativo!==undefined&&input.ativo!==existing.ativo||input.permissoes!==undefined&&([...new Set(input.permissoes)].sort().join(',')!==[...existing.permissoes].sort().join(','))||input.senha!==undefined;
    const novaHash=input.senha?await bcrypt.hash(input.senha,12):undefined;
    const user = await this.gravar(()=>this.prisma.saasOperador.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome } : {}),
        ...(input.email !== undefined ? { email: email || null } : {}),
        ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
        ...(input.permissoes !== undefined ? { permissoes: [...new Set(input.permissoes)] } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
        ...(input.senha ? { senha: novaHash } : {}),
        ...(revogar?{sessaoId:null}:{}),
      },
    }));
    return this.publicUser(user);
  }

  async encerrarSessao(id:string,operadorId:string){
    const actor=await this.ator(operadorId);
    const target=await this.prisma.saasOperador.findUnique({where:{id}});
    if(!target)throw new BadRequestException('Operador não encontrado.');
    if(target.cargo===SaasCargo.SUPER_ADMIN||id===operadorId)throw new ForbiddenException('Administradores principais e a própria conta encerram a sessão pelo menu de perfil.');
    this.podeDelegar(actor,target.permissoes);
    await this.prisma.saasOperador.update({where:{id},data:{sessaoId:null}});
    return {encerrada:true};
  }
}
