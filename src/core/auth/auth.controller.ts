import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ValidarGerenteDto } from './dto/validar-gerente.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentEmpresa } from './decorators/current-empresa.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @CurrentEmpresa() empresaId?: number) {
    return this.authService.login(dto, empresaId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('validar-gerente')
  async validarGerente(
    @Body() dto: ValidarGerenteDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.authService.validarGerente(dto, empresaId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  getPerfil(@Request() req) {
    return req.user;
  }
}