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
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: { sub: string; email: string; empresaId?: number; sessaoId?: string; proposito?: string }) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        ativo: true,
        email: true,
        permissoes: true,
        sessaoId: true,
        primeiroAcesso: true,
        funcionarioId: true,
        funcionario: {
          select: {
            id: true,
            ativo: true,
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

    if (!usuario || !usuario.ativo || !usuario.funcionario || !usuario.funcionario.ativo ||
        usuario.primeiroAcesso || !payload.sessaoId || !usuario.sessaoId ||
        payload.sessaoId !== usuario.sessaoId || payload.proposito === 'PRIMEIRO_ACESSO') {
      throw new UnauthorizedException('Utilizador não encontrado ou sem vínculo de funcionário.');
    }

    if (payload.empresaId !== usuario.funcionario.empresaId || !['ATIVA', 'EM_TESTE'].includes(usuario.funcionario.empresa.status)) {
      throw new UnauthorizedException('A empresa vinculada a este utilizador encontra-se inativa.');
    }

    return {
      ...usuario,
      empresaId: usuario.funcionario.empresaId,
      subdominio: usuario.funcionario.empresa.subdominio || usuario.funcionario.empresa.slug,
      cargo: usuario.funcionario.cargo,
    };
  }
}