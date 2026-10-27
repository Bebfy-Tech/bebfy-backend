import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, empresaId?: number) {
    // 1. Busca o usuário incluindo os dados do Funcionário e da Empresa
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: {
        funcionario: {
          include: {
            empresa: true,
          },
        },
      },
    });

    if (!usuario || !usuario.funcionario) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    // 2. Se a requisição veio de um subdomínio específico, valida se o usuário pertence a essa empresa
    if (empresaId && usuario.funcionario.empresaId !== empresaId) {
      throw new UnauthorizedException(
        'Usuário não possui acesso a esta empresa.',
      );
    }

    // 3. Valida a senha com hash via bcrypt
    const senhaValida = await bcrypt.compare(dto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    const empresa = usuario.funcionario.empresa;

    // 4. Monta o payload do JWT com as informações multi-tenant
    const payload = {
      sub: usuario.id,
      email: usuario.email,
      empresaId: empresa.id,
      subdominio: empresa.subdominio || empresa.slug,
      funcionarioId: usuario.funcionarioId,
      cargo: usuario.funcionario.cargo,
    };

    // 5. Retorna o token assinado e as informações da sessão
    return {
      access_token: await this.jwtService.signAsync(payload),
      empresa: {
        id: empresa.id,
        nomeFantasia: empresa.nomeFantasia,
        subdominio: empresa.subdominio || empresa.slug,
      },
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.funcionario.nome,
        cargo: usuario.funcionario.cargo,
        funcionarioId: usuario.funcionarioId,
      },
    };
  }
}