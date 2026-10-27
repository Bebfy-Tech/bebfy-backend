import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host || '';
    const parts = host.split('.');

    // Se estiver em subdomínio (ex: adega.bebfy.app), pega a 1ª parte.
    // Em localhost/IP, usa o header 'x-tenant' enviado pelo frontend/Postman.
    const subdominio =
      parts.length > 2 && !host.includes('localhost')
        ? parts[0]
        : (req.headers['x-tenant'] as string) || (req.headers['x-subdominio'] as string);

    if (subdominio) {
      const empresa = await this.prisma.empresa.findFirst({
        where: {
          OR: [{ subdominio }, { slug: subdominio }],
        },
      });

      if (!empresa || empresa.status !== 'ATIVA') {
        throw new NotFoundException(
          `Empresa do subdomínio "${subdominio}" não foi localizada ou encontra-se inativa.`,
        );
      }

      (req as any).empresa = empresa;
    }

    next();
  }
}