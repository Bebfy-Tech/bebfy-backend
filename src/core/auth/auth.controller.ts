import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ValidarGerenteDto } from './dto/validar-gerente.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate Limiting Estrito: Bloqueia após 5 tentativas de login em 1 minuto
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @CurrentTenant() empresaId?: number,
  ) {
    return this.authService.login(dto, empresaId);
  }

  // Validação de senha de gerente no PDV protegida por JWT, Tenant e Throttler
  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  @Post('validar-gerente')
  async validarGerente(
    @CurrentTenant() empresaId: number,
    @Body() dto: ValidarGerenteDto,
  ) {
    return this.authService.validarGerente(dto, empresaId);
  }

  // Retorna a sessão do utilizador logado e os dados da empresa vinculada
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get('perfil')
  getPerfil(@Request() req: any) {
    return req.user;
  }
}