import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  // Injeta o serviço de autenticação
  constructor(private readonly authService: AuthService) {}

  // Rota pública de Login
  @Post('login')
  async login(@Body() body: { email: string; senha: string }) {
    // Passa o objeto 'body' completo (1 único argumento) para o AuthService
    return this.authService.login(body);
  }

  // Rota protegida por JWT (retorna os dados do utilizador autenticado)
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  getPerfil(@Request() req) {
    // Retorna os dados do utilizador injetados pelo JwtStrategy em req.user
    return req.user;
  }
}