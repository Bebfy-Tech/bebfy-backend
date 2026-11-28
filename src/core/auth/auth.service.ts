import {
  BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { consultarModulos } from '../../common/modulos/plano-modulos';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ValidarGerenteDto } from './dto/validar-gerente.dto';
import { AlterarSenhaPrimeiroAcessoDto } from './dto/alterar-senha-primeiro-acesso.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AtualizarMeuPerfilDto } from './dto/atualizar-meu-perfil.dto';
import { ConfirmarRecuperacaoSenhaDto } from './dto/recuperar-senha.dto';

@Injectable()
export class AuthService {
  private readonly logger=new Logger(AuthService.name);
  private validarNovaSenha(senha:string){
    if(typeof senha!=='string'||senha.length<12||!senha.trim()||Buffer.byteLength(senha,'utf8')>72)throw new BadRequestException('A nova senha deve ter ao menos 12 caracteres e no máximo 72 bytes.');
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async modulosDisponiveis(empresaId: number) {
    return { modulos: await consultarModulos(this.prisma, empresaId) };
  }

  private responder(usuario: any, sessaoId: string) {
    const empresa = usuario.funcionario.empresa;
    return {
      access_token: this.jwtService.sign({
        sub: usuario.id, email: usuario.email, empresaId: empresa.id,
        subdominio: empresa.subdominio || empresa.slug,
        funcionarioId: usuario.funcionarioId,
        cargo: usuario.funcionario.cargo, codigoFuncionario: usuario.funcionario.codigo,
        sessaoId,
      }),
      empresa: {
        id: empresa.id, nomeFantasia: empresa.nomeFantasia,
        subdominio: empresa.subdominio || empresa.slug,
      },
      usuario: {
        id: usuario.id, codigo: usuario.funcionario.codigo,
        nome: usuario.funcionario.nome, cargo: usuario.funcionario.cargo,
        funcionarioId: usuario.funcionarioId, permissoes: usuario.permissoes,
      },
    };
  }

  private async usuarioPorLogin(login: string, empresaId: number) {
    const codigoNumero = Number(login);
    const isNumero = /^\d+$/.test(login) && Number.isSafeInteger(codigoNumero) && codigoNumero<=2147483647 && codigoNumero>0;
    return this.prisma.usuario.findFirst({
      where: {
        ativo: true,
        funcionario: {
          ativo: true, empresaId,
          OR: [
            ...(isNumero ? [{ codigo: codigoNumero }] : []),
            { cpf: login },
          ],
        },
      },
      include: { funcionario: { include: { empresa: true } } },
    });
  }

  async login(dto: LoginDto, empresaId?: number) {
    if (!empresaId) {
      throw new UnauthorizedException('Identifique a empresa antes de efetuar login.');
    }
    if(Buffer.byteLength(dto.senha,'utf8')>72)throw new UnauthorizedException('Código do funcionário ou senha incorretos.');
    const usuario = await this.usuarioPorLogin(dto.login, empresaId);
    if (!usuario || usuario.funcionario.empresaId !== empresaId ||
        !await bcrypt.compare(dto.senha, usuario.senha)) {
      throw new UnauthorizedException('Código do funcionário ou senha incorretos.');
    }
    if (!['ATIVA', 'EM_TESTE'].includes(usuario.funcionario.empresa.status)) {
      throw new UnauthorizedException('Empresa inativa.');
    }

    if (usuario.primeiroAcesso) {
      // Short-lived purpose-scoped token cannot access JwtAuthGuard or tenant data.
      return {
        trocaSenhaObrigatoria: true as const,
        tokenTroca: await this.jwtService.signAsync({
          sub: usuario.id, empresaId, proposito: 'PRIMEIRO_ACESSO',
        }, { expiresIn: '10m' }),
      };
    }

    const atividadeRecente = usuario.ultimaAtividadeEm &&
      Date.now() - usuario.ultimaAtividadeEm.getTime() < 2 * 60 * 1000;
    if (usuario.sessaoId && atividadeRecente && !dto.assumirSessao) {
      throw new ConflictException({
        codigo: 'SESSAO_ATIVA',
        message: 'Já existe uma sessão ativa neste usuário. Deseja entrar e desconectar o outro acesso?',
      });
    }

    const novaSessao = randomUUID();
    const result = await this.prisma.usuario.updateMany({
      where: { id: usuario.id, ativo: true, sessaoId: usuario.sessaoId, senha:usuario.senha, primeiroAcesso:false },
      data: { sessaoId: novaSessao, ultimaAtividadeEm: new Date() },
    });
    if (result.count !== 1) {
      throw new ConflictException({
        codigo: 'SESSAO_ATIVA',
        message: 'O estado da sessão mudou. Confirme novamente para entrar.',
      });
    }
    return this.responder(usuario, novaSessao);
  }

  async solicitarRecuperacaoSenha(login: string, empresaId?: number) {
    const generic = { mensagem: 'Se o acesso estiver cadastrado, enviaremos instruções ao e-mail do proprietário.' };
    if (!empresaId) throw new UnauthorizedException('Distribuidora não identificada.');
    const apiKey=process.env.RESEND_API_KEY;
    const from=process.env.RESEND_FROM_EMAIL;
    const base=process.env.FRONTEND_PUBLIC_URL;
    if(!apiKey || !from || !base) {
      throw new ServiceUnavailableException('Recuperação por e-mail ainda não configurada. Contate o administrador.');
    }
    const usuario=await this.usuarioPorLogin(login,empresaId);
    if(!usuario || usuario.funcionario.empresaId!==empresaId)return generic;
    const owner=await this.prisma.usuario.findFirst({
      where: {ativo:true,funcionario:{empresaId,cargo:'PROPRIETARIO',ativo:true}},
      select: { email:true },orderBy:{criadoEm:'asc'},
    });
    if(!owner?.email)return generic;
    const token=randomBytes(32).toString('hex');
    const tokenHash=createHash('sha256').update(token).digest('hex');
    const expiraEm=new Date(Date.now()+15*60*1000);
    await this.prisma.$transaction(async tx=>{
      await tx.resetSenhaToken.deleteMany({where:{usuarioId:usuario.id,usadoEm:null}});
      await tx.resetSenhaToken.create({data:{usuarioId:usuario.id,empresaId,tokenHash,expiraEm}});
    });
    const tenant=usuario.funcionario.empresa.subdominio||usuario.funcionario.empresa.slug;
    let url:string;
    try {
      const baseUrl=new URL(base);
      if(!['https:','http:'].includes(baseUrl.protocol))throw new Error('Invalid origin');
      url=new URL('/'+encodeURIComponent(tenant)+'/recuperar-senha?token='+token,baseUrl).toString();
    }catch{
      await this.prisma.resetSenhaToken.deleteMany({where:{tokenHash}});
      throw new ServiceUnavailableException('Configuração da recuperação indisponível.');
    }
    try {
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          from,to:[owner.email],subject:'Bebfy · Recuperação de acesso',
          text:'Foi solicitada a recuperação do acesso do funcionário código '+
            (usuario.funcionario.codigo??'não informado')+
            ' na distribuidora '+usuario.funcionario.empresa.nomeFantasia+
            '. Use este link pessoal, válido por 15 minutos: '+url+
            '\nSe você não solicitou, ignore este e-mail.',
        }),
        signal:AbortSignal.timeout(8000),
      });
      if(!response.ok)throw new Error('Email provider returned an error');
    }catch{
      await this.prisma.resetSenhaToken.deleteMany({where:{tokenHash}});
      // Do not reveal account existence when the mail provider fails.
      this.logger.warn('Falha no envio de recuperação de acesso.');
      return generic;
    }
    return generic;
  }

  async confirmarRecuperacaoSenha(dto: ConfirmarRecuperacaoSenhaDto, empresaId?:number) {
    if(!empresaId)throw new UnauthorizedException('Distribuidora não identificada.');
    this.validarNovaSenha(dto.novaSenha);
    if(dto.novaSenha!==dto.confirmarNovaSenha)throw new BadRequestException('Confirmação da senha não corresponde.');
    const hash=createHash('sha256').update(dto.token).digest('hex');
    const token=await this.prisma.resetSenhaToken.findUnique({where:{tokenHash:hash}});
    if(!token || token.empresaId!==empresaId || token.usadoEm || token.expiraEm.getTime()<Date.now())
      throw new UnauthorizedException('Link de recuperação inválido ou expirado.');
    const user=await this.prisma.usuario.findUnique({
      where:{id:token.usuarioId},
      include:{funcionario:true},
    });
    if(!user?.ativo || !user.funcionario.ativo || user.funcionario.empresaId!==empresaId)
      throw new UnauthorizedException('Acesso inválido ou desativado.');
    const novaHash=await bcrypt.hash(dto.novaSenha,12);
    await this.prisma.$transaction(async tx=>{
      const used=await tx.resetSenhaToken.updateMany({
        where:{id:token.id,usadoEm:null,expiraEm:{gt:new Date()}},
        data:{usadoEm:new Date()},
      });
      if(used.count!==1)throw new UnauthorizedException('Link já utilizado.');
      const updated=await tx.usuario.updateMany({
        where:{id:user.id,ativo:true,senha:user.senha,funcionario:{ativo:true,empresaId}},
        data:{senha:novaHash,primeiroAcesso:false,sessaoId:null,ultimaAtividadeEm:null},
      });
      if(updated.count!==1)throw new UnauthorizedException('Acesso alterado. Solicite outro link.');
      await tx.resetSenhaToken.deleteMany({where:{usuarioId:user.id,usadoEm:null}});
    });
    return {alterada:true,mensagem:'Senha alterada. Entre novamente com a nova senha.'};
  }

  async alterarPrimeiraSenha(dto: AlterarSenhaPrimeiroAcessoDto,empresaId?:number) {
    this.validarNovaSenha(dto.novaSenha);
    if (dto.novaSenha !== dto.confirmarNovaSenha) {
      throw new BadRequestException('A confirmação da nova senha não corresponde.');
    }
    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException('A nova senha deve ser diferente da atual.');
    }
    let payload: { sub: string; empresaId: number; proposito: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.tokenTroca);
    } catch {
      throw new UnauthorizedException('Link de troca expirado. Entre novamente.');
    }
    if (payload.proposito !== 'PRIMEIRO_ACESSO' || !payload.sub || !empresaId || payload.empresaId!==empresaId) {
      throw new UnauthorizedException('Autorização de primeiro acesso inválida.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { funcionario: { include: { empresa: true } } },
    });
    if (!usuario || !usuario.ativo || !usuario.funcionario.ativo ||
        usuario.funcionario.empresaId !== payload.empresaId || !usuario.primeiroAcesso ||
        !['ATIVA', 'EM_TESTE'].includes(usuario.funcionario.empresa.status) ||
        (usuario.funcionario.empresa.inadimplente&&(!usuario.funcionario.empresa.liberacaoFinanceiraAte||usuario.funcionario.empresa.liberacaoFinanceiraAte.getTime()<=Date.now())) ||
        Buffer.byteLength(dto.senhaAtual,'utf8')>72 || !await bcrypt.compare(dto.senhaAtual, usuario.senha)) {
      throw new UnauthorizedException('Credenciais de primeiro acesso inválidas.');
    }

    const hash = await bcrypt.hash(dto.novaSenha, 12);
    const sessaoId = randomUUID();
    const result=await this.prisma.$transaction(async tx=>{
      const changed=await tx.usuario.updateMany({where:{id:usuario.id,ativo:true,primeiroAcesso:true,senha:usuario.senha,funcionario:{ativo:true,empresaId}},data:{senha:hash,primeiroAcesso:false,sessaoId,ultimaAtividadeEm:new Date()}});
      if(changed.count===1)await tx.resetSenhaToken.deleteMany({where:{usuarioId:usuario.id,usadoEm:null}});
      return changed;
    });
    if (result.count !== 1) {
      throw new ConflictException('Senha já alterada em outra solicitação. Entre novamente.');
    }
    return this.responder(usuario, sessaoId);
  }

  async alterarSenha(usuarioId: string, sessaoId: string, dto: AlterarSenhaDto) {
    this.validarNovaSenha(dto.novaSenha);
    if (dto.novaSenha !== dto.confirmarNovaSenha) {
      throw new BadRequestException('A confirmação da nova senha não corresponde.');
    }
    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId }, select: { senha: true, ativo: true, sessaoId: true },
    });
    if(!usuario?.ativo||usuario.sessaoId!==sessaoId)throw new UnauthorizedException('Sessão inválida.');
    if(Buffer.byteLength(dto.senhaAtual,'utf8')>72||!await bcrypt.compare(dto.senhaAtual,usuario.senha))throw new BadRequestException('Senha atual incorreta.');
    const hash=await bcrypt.hash(dto.novaSenha,12);
    const result=await this.prisma.$transaction(async tx=>{
      const changed=await tx.usuario.updateMany({where:{id:usuarioId,ativo:true,sessaoId,senha:usuario.senha},data:{senha:hash,sessaoId:null,ultimaAtividadeEm:null}});
      if(changed.count===1)await tx.resetSenhaToken.deleteMany({where:{usuarioId,usadoEm:null}});
      return changed;
    });
    if (!result.count) throw new ConflictException('Senha ou sessão alterada em outro acesso.');
    return { alterada: true, mensagem: 'Senha alterada. Faça login novamente.' };
  }

  async atualizarMeuPerfil(usuarioId: string, empresaId: number, dto: AtualizarMeuPerfilDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { funcionario: true },
    });
    if (!usuario?.ativo || !usuario.funcionario.ativo ||
        usuario.funcionario.empresaId !== empresaId) throw new UnauthorizedException('Usuário não autorizado.');
    if (dto.email && dto.email.toLowerCase() !== usuario.email) {
      const exists = await this.prisma.usuario.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (exists) throw new ConflictException('E-mail já cadastrado.');
    }
    await this.prisma.$transaction(async tx => {
      if (dto.email !== undefined) {
        await tx.usuario.update({ where: { id: usuarioId },
          data: { email: dto.email.trim().toLowerCase() } });
      }
      if (dto.nome !== undefined || dto.telefone !== undefined) {
        await tx.funcionario.update({ where: { id: usuario.funcionarioId },
          data: {
            ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
            ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
          },
        });
      }
    });
    return { atualizado: true };
  }

  async sair(usuarioId: string, sessaoId: string) {
    await this.prisma.usuario.updateMany({
      where: { id: usuarioId, sessaoId },
      data: { sessaoId: null, ultimaAtividadeEm: null },
    });
    return { encerrada: true };
  }

  async validarGerente(dto: ValidarGerenteDto, empresaId: number) {
    const usuario = await this.usuarioPorLogin(dto.login, empresaId);
    if (!usuario || usuario.primeiroAcesso ||
      !['GERENTE', 'ADMINISTRADOR', 'PROPRIETARIO'].includes(usuario.funcionario.cargo) ||
      !await bcrypt.compare(dto.senha, usuario.senha)) {
      throw new UnauthorizedException('Credenciais de autorização inválidas.');
    }
    return {
      autorizado: true,
      gerenteId: usuario.id,
      codigoGerente: usuario.funcionario.codigo,
      nomeGerente: usuario.funcionario.nome,
    };
  }
}
