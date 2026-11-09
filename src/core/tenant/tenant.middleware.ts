import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // API may run on api.bebfy.com.br while frontend runs on a different host.
      // Prefer explicit x-tenant. Never interpret the generic API hostname as a store.
      const host = (req.headers.host || '').split(':')[0].toLowerCase();
      const requestedTenant = req.headers['x-tenant'] || req.headers['x-subdominio'];
      const baseDomain = (process.env.TENANT_BASE_DOMAIN || '').toLowerCase().trim();
      const suffix = baseDomain ? '.' + baseDomain : '';
      const fromSubdomain = suffix && host.endsWith(suffix)
        ? host.slice(0, -suffix.length)
        : '';
      const subdominio = typeof requestedTenant === 'string' && requestedTenant.trim()
        ? requestedTenant.trim().toLowerCase()
        : (fromSubdomain && !fromSubdomain.includes('.') && fromSubdomain !== 'api'
          ? fromSubdomain : '');

      if (subdominio && this.prisma?.empresa) {
        const empresa = await this.prisma.empresa.findFirst({
          where: {
            OR: [{ subdominio }, { slug: subdominio }],
          },
        });

        if (!empresa || !['ATIVA', 'EM_TESTE'].includes(empresa.status)) {
          throw new NotFoundException(
            `Empresa do subdomínio "${subdominio}" não foi localizada ou encontra-se inativa.`,
          );
        }

        (req as any).empresa = empresa;
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}