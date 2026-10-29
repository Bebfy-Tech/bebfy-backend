import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ValidarGerenteDto } from './dto/validar-gerente.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, empresaId?: number) {
    const codigoNumero = Number(dto.login);
    const isNumero = !isNaN(codigoNumero);

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        ativo: true,
        funcionario: {
          ativo: true,
          OR: [
            ...(isNumero ? [{ codigo: codigoNumero }] : []),
            { cpf: dto.login },
          ],
        },
      },
      include: {
        funcionario: {
          include: {
            empresa: true,
          },
        },
      },
    });

    if (!usuario || !usuario.funcionario) {
      throw new UnauthorizedException('Código do funcionário ou senha incorretos.');
    }

    if (empresaId && usuario.funcionario.empresaId !== empresaId) {
      throw new UnauthorizedException('Usuário não possui acesso a esta empresa.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Código do funcionário ou senha incorretos.');
    }

    const empresa = usuario.funcionario.empresa;

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      empresaId: empresa.id,
      subdominio: empresa.subdominio || empresa.slug,
      funcionarioId: usuario.funcionarioId,
      cargo: usuario.funcionario.cargo,
      codigoFuncionario: usuario.funcionario.codigo,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      empresa: {
        id: empresa.id,
        nomeFantasia: empresa.nomeFantasia,
        subdominio: empresa.subdominio || empresa.slug,
      },
      usuario: {
        id: usuario.id,
        codigo: usuario.funcionario.codigo,
        nome: usuario.funcionario.nome,
        cargo: usuario.funcionario.cargo,
        funcionarioId: usuario.funcionarioId,
      },
    };
  }

  async validarGerente(dto: ValidarGerenteDto, empresaId: number) {
    const codigoNumero = Number(dto.login);
    const isNumero = !isNaN(codigoNumero);

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        ativo: true,
        funcionario: {
          empresaId,
          ativo: true,
          OR: [
            ...(isNumero ? [{ codigo: codigoNumero }] : []),
            { cpf: dto.login },
          ],
        },
      },
      include: {
        funcionario: true,
      },
    });

    if (!usuario || !usuario.funcionario) {
      throw new UnauthorizedException('Gerente/Admin não encontrado com este código.');
    }

    const cargosAutorizados = ['GERENTE', 'ADMINISTRADOR', 'PROPRIETARIO'];
    if (!cargosAutorizados.includes(usuario.funcionario.cargo)) {
      throw new UnauthorizedException('Usuário informado não possui nível de acesso de Gerente/Admin.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Senha de autorização incorreta.');
    }

    return {
      autorizado: true,
      gerenteId: usuario.id,
      codigoGerente: usuario.funcionario.codigo,
      nomeGerente: usuario.funcionario.nome,
    };
  }
}