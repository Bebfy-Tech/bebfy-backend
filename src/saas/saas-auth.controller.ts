import { Body, Controller, Get, HttpCode, Patch, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsArray, IsBoolean, IsNotEmpty, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { SaasCargo } from '@prisma/client';
import { SaasAuthService } from './saas-auth.service';
import { SaasAuthGuard, SaasPermissionGuard } from './saas-auth.guard';

class LoginSaasDto {
  @Type(() => Number) @IsInt() @Min(1) codigo: number;
  @IsString() @MinLength(1) senha: string;
}
class CriarOperadorDto {
  @Type(() => Number) @IsInt() @Min(1) codigo: number;
  @IsString() @MinLength(2) @MaxLength(120) nome: string;
  @IsString() @IsNotEmpty() senha: string;
  @IsEnum(SaasCargo) cargo: SaasCargo;
  @IsArray() @IsString({each: true}) permissoes: string[];
}
class EditarOperadorDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) codigo?: number;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nome?: string;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsString() @IsNotEmpty() senha?: string;
  @IsOptional() @IsArray() @IsString({each: true}) permissoes?: string[];
  @IsOptional() @IsBoolean() ativo?: boolean;
}
class MeuPerfilSaasDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nome?: string;
  @IsOptional() @IsString() senhaAtual?: string;
  @IsOptional() @IsString() @IsNotEmpty() novaSenha?: string;
}
@Controller('saas/auth')
export class SaasAuthController {
  constructor(private readonly service: SaasAuthService) {}
  @Post('login') @HttpCode(200) @Throttle({ strict: {limit: 5, ttl: 60000}})
  entrar(@Body() dto: LoginSaasDto) { return this.service.login(dto.codigo, dto.senha); }
  @Get('perfil') @UseGuards(SaasAuthGuard)
  perfil(@Req() req: any) {
    const { id, codigo, nome, email, cargo, permissoes, ativo } = req.saasUser;
    return { id, codigo, nome, email, cargo, permissoes, ativo };
  }
  @Patch('perfil') @UseGuards(SaasAuthGuard)
  atualizarPerfil(@Req() req: any, @Body() dto: MeuPerfilSaasDto) {
    return this.service.atualizarPerfil(req.saasUser.id, dto);
  }
  @Post('logout') @HttpCode(200) @UseGuards(SaasAuthGuard)
  sair(@Req() req: any) { return this.service.sair(req.saasUser.id, req.saasUser.sessaoId); }
}
@Controller('saas/admin/funcionarios')
@UseGuards(SaasAuthGuard, SaasPermissionGuard('FUNCIONARIOS'))
export class SaasStaffController {
  constructor(private readonly service: SaasAuthService) {}
  @Get() listar() { return this.service.listar(); }
  @Post() criar(@Body() dto: CriarOperadorDto) { return this.service.criar(dto); }
  @Patch(':id') editar(@Param('id') id: string, @Req() req: any, @Body() dto: EditarOperadorDto) { return this.service.atualizar(id, dto, req.saasUser.id); }
}
