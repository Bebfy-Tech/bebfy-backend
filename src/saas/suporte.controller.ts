import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { SaasSuperAdminGuard } from './guards/saas-super-admin.guard';
import { IniciarSessaoSuporteDto } from './dto/iniciar-sessao-suporte.dto';
import { SuporteService } from './suporte.service';

@ApiTags('Suporte da Plataforma')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, SaasSuperAdminGuard)
@Controller('saas/admin/suporte')
export class SuporteController {
  constructor(private readonly suporte: SuporteService) {}

  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @Post('sessoes')
  iniciar(@Req() req: any, @Body() dto: IniciarSessaoSuporteDto) {
    return this.suporte.iniciar(req.user.id, dto, req.ip);
  }

  @Get('sessoes/:id/diagnostico')
  diagnostico(@Req() req: any, @Param('id') id: string) {
    return this.suporte.diagnostico(req.user.id, id, req.ip);
  }

  @Post('sessoes/:id/encerrar')
  encerrar(@Req() req: any, @Param('id') id: string) {
    return this.suporte.encerrar(req.user.id, id, req.ip);
  }
}
