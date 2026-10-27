import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'segredo_super_secreto',
    });
  }

  async validate(payload: { sub: string; email: string; empresaId?: number }) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        permissoes: true,
        funcionarioId: true,
        funcionario: {
          select: {
            id: true,
            nome: true,
            cargo: true,
            empresaId: true,
            empresa: {
              select: {
                id: true,
                nomeFantasia: true,
                subdominio: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!usuario || !usuario.funcionario) {
      throw new UnauthorizedException('Utilizador não encontrado ou sem vínculo de funcionário.');
    }

    if (usuario.funcionario.empresa.status !== 'ATIVA') {
      throw new UnauthorizedException('A empresa vinculada a este utilizador encontra-se inativa.');
    }

    // Retorna os dados do utilizador e injeta empresaId e cargo na raiz do objeto req.user
    return {
      ...usuario,
      empresaId: usuario.funcionario.empresaId,
      subdominio: (usuario.funcionario.empresa as any).subdominio || usuario.funcionario.empresa.slug,
      cargo: usuario.funcionario.cargo,
    };
  }
}