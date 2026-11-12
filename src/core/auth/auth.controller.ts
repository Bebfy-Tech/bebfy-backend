import {
  Controller,
  Post,
  Get,
  Patch,
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
import { AlterarSenhaPrimeiroAcessoDto } from './dto/alterar-senha-primeiro-acesso.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { AtualizarMeuPerfilDto } from './dto/atualizar-meu-perfil.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Login inicial e confirmação de troca de sessão compartilham a mesma janela.
  @Throttle({ strict: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Request() req: any,
  ) {
    return this.authService.login(dto, req.empresa?.id);
  }

  @Throttle({ strict: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @Post('primeiro-acesso/alterar-senha')
  alterarSenhaInicial(@Body() dto: AlterarSenhaPrimeiroAcessoDto) {
    return this.authService.alterarPrimeiraSenha(dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  @Post('alterar-senha')
  alterarSenha(@Request() req: any, @Body() dto: AlterarSenhaDto) {
    return this.authService.alterarSenha(req.user.id, req.user.sessaoId, dto);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.sair(req.user.id, req.user.sessaoId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard)
  @Patch('perfil')
  atualizarMeuPerfil(@Request() req: any, @Body() dto: AtualizarMeuPerfilDto) {
    return this.authService.atualizarMeuPerfil(req.user.id, req.user.empresaId, dto);
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