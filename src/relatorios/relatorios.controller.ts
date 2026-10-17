import { Controller, Get, UseGuards } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  // GET /relatorios/dashboard -> Retorna métricas do painel principal
  @Get('dashboard')
  getDashboard() {
    return this.relatoriosService.getDashboard();
  }
}