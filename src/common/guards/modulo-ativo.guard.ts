import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NomeModulo } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { consultarModulos } from '../modulos/plano-modulos';

const MODULO_KEY = 'bebfy:modulo-requerido';
export const ExigirModulo = (modulo: NomeModulo) => SetMetadata(MODULO_KEY, modulo);

/**
 * Plano contratual + exceções explícitas. Empresas antigas sem plano mantêm os módulos operacionais.
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

    const modulos = await consultarModulos(this.prisma, empresaId);
    if (!modulos[modulo]) {
      throw new ForbiddenException('Módulo não disponível no plano desta distribuidora.');
    }
    return true;
  }
}
