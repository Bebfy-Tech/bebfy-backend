import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NomeModulo } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

const MODULO_KEY = 'bebfy:modulo-requerido';
export const ExigirModulo = (modulo: NomeModulo) => SetMetadata(MODULO_KEY, modulo);

/**
 * Tenant modules are enabled by default for existing customers without a row,
 * but an explicit EmpresaModulo.ativo=false blocks the protected feature.
 * This keeps upgrades backward-compatible while making SaaS toggles enforceable.
 */
@Injectable()
export class ModuloAtivoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const modulo = this.reflector.getAllAndOverride<NomeModulo>(MODULO_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!modulo) return true;

    const request = context.switchToHttp().getRequest();
    const empresaId: number | undefined = request.user?.empresaId;
    if (!empresaId) throw new ForbiddenException('Empresa não identificada para validar o módulo.');

    const configuracao = await this.prisma.empresaModulo.findUnique({
      where: { empresaId_modulo: { empresaId, modulo } },
      select: { ativo: true },
    });
    if (configuracao && !configuracao.ativo) {
      throw new ForbiddenException('Módulo desativado para esta distribuidora.');
    }
    return true;
  }
}
