import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarAuditoriaDto } from './dto/criar-auditoria.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(dto: CriarAuditoriaDto) {
    try {
      return await this.prisma.logAuditoria.create({
        data: {
          empresaId: dto.empresaId,
          usuarioId: dto.usuarioId,
          acao: dto.acao,
          entidade: dto.entidade,
          entidadeId: dto.entidadeId,
          detalhes: dto.detalhes,
          ip: dto.ip,
        },
      });
    } catch (error) {
      console.error('Erro ao gravar log de auditoria:', error);
    }
  }

  async listarPorEmpresa(empresaId: number) {
    return this.prisma.logAuditoria.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
      take: 100, // Limita aos últimos 100 logs para performance
    });
  }
}