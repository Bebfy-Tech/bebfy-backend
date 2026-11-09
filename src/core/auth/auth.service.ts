import {
  BadRequestException, ConflictException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ValidarGerenteDto } from './dto/validar-gerente.dto';
import { AlterarSenhaPrimeiroAcessoDto } from './dto/alterar-senha-primeiro-acesso.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
        funcionarioId: usuario.funcionarioId,
      },
    };
  }

  private async usuarioPorLogin(login: string, empresaId: number) {
    const codigoNumero = Number(login);
    const isNumero = /^\d+$/.test(login) && Number.isSafeInteger(codigoNumero);
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

    if (usuario.sessaoId && !dto.assumirSessao) {
      throw new ConflictException({
        codigo: 'SESSAO_ATIVA',
        message: 'Já existe uma sessão ativa neste usuário. Deseja entrar e desconectar o outro acesso?',
      });
    }

    const novaSessao = randomUUID();
    const result = await this.prisma.usuario.updateMany({
      where: { id: usuario.id, ativo: true, sessaoId: usuario.sessaoId },
      data: { sessaoId: novaSessao },
    });
    if (result.count !== 1) {
      throw new ConflictException({
        codigo: 'SESSAO_ATIVA',
        message: 'O estado da sessão mudou. Confirme novamente para entrar.',
      });
    }
    return this.responder(usuario, novaSessao);
  }

  async alterarPrimeiraSenha(dto: AlterarSenhaPrimeiroAcessoDto) {
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
    if (payload.proposito !== 'PRIMEIRO_ACESSO' || !payload.sub || !payload.empresaId) {
      throw new UnauthorizedException('Autorização de primeiro acesso inválida.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { funcionario: { include: { empresa: true } } },
    });
    if (!usuario || !usuario.ativo || !usuario.funcionario.ativo ||
        usuario.funcionario.empresaId !== payload.empresaId || !usuario.primeiroAcesso ||
        !['ATIVA', 'EM_TESTE'].includes(usuario.funcionario.empresa.status) ||
        !await bcrypt.compare(dto.senhaAtual, usuario.senha)) {
      throw new UnauthorizedException('Credenciais de primeiro acesso inválidas.');
    }

    const hash = await bcrypt.hash(dto.novaSenha, 12);
    const sessaoId = randomUUID();
    const result = await this.prisma.usuario.updateMany({
      where: { id: usuario.id, ativo: true, primeiroAcesso: true, senha: usuario.senha },
      data: { senha: hash, primeiroAcesso: false, sessaoId },
    });
    if (result.count !== 1) {
      throw new ConflictException('Senha já alterada em outra solicitação. Entre novamente.');
    }
    return this.responder(usuario, sessaoId);
  }

  async alterarSenha(usuarioId: string, sessaoId: string, dto: AlterarSenhaDto) {
    if (dto.novaSenha !== dto.confirmarNovaSenha) {
      throw new BadRequestException('A confirmação da nova senha não corresponde.');
    }
    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId }, select: { senha: true, ativo: true, sessaoId: true },
    });
    if (!usuario?.ativo || usuario.sessaoId !== sessaoId ||
        !await bcrypt.compare(dto.senhaAtual, usuario.senha)) {
      throw new UnauthorizedException('Senha atual ou sessão inválida.');
    }
    const result = await this.prisma.usuario.updateMany({
      where: { id: usuarioId, sessaoId, senha: usuario.senha },
      data: { senha: await bcrypt.hash(dto.novaSenha, 12), sessaoId: randomUUID() },
    });
    if (!result.count) throw new ConflictException('Senha ou sessão alterada em outro acesso.');
    return { alterada: true, mensagem: 'Senha alterada. Faça login novamente.' };
  }

  async sair(usuarioId: string, sessaoId: string) {
    await this.prisma.usuario.updateMany({
      where: { id: usuarioId, sessaoId },
      data: { sessaoId: null },
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
