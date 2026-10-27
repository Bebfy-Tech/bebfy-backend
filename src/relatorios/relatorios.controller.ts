import { Controller, Get, UseGuards } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { CurrentEmpresa } from '../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  // GET /relatorios/dashboard -> Retorna métricas do painel filtradas por empresa
  @Get('dashboard')
  getDashboard(@CurrentEmpresa() empresaId: number) {
    return this.relatoriosService.getDashboard(empresaId);
  }
}