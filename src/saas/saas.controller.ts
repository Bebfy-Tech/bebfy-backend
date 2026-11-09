import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SaasService } from './saas.service';
import { SaasAuthGuard, SaasPermissionGuard } from './saas-auth.guard';
import { AlterarStatusEmpresaDto } from './dto/alterar-status-empresa.dto';
import { AlternarModuloDto } from './dto/alternar-modulo.dto';
import { AlterarPlanoDto } from './dto/alterar-plano.dto';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';
import { CriarPlanoDto, AtualizarPlanoDto } from './dto/criar-plano.dto';

@UseGuards(SaasAuthGuard)
@Controller('saas/admin')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  // NOVO: Rota POST para incluir uma nova empresa cliente no SaaS
  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('empresas')
  criarEmpresa(@Body() dto: CriarEmpresaDto) {
    return this.saasService.criarEmpresa(dto);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('empresas')
  listarEmpresas() {
    return this.saasService.listarEmpresas();
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('empresas/:id')
  buscarEmpresaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.buscarEmpresaPorId(id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/status')
  alterarStatusEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarStatusEmpresaDto,
  ) {
    return this.saasService.alterarStatusEmpresa(id, dto.status);
  }

  @UseGuards(SaasPermissionGuard('MODULOS'))
  @Patch('empresas/:id/modulos')
  alternarModuloEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlternarModuloDto,
  ) {
    return this.saasService.alternarModuloEmpresa(id, dto.modulo, dto.ativo);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Post('planos')
  criarPlano(@Body() dto: CriarPlanoDto) {
    return this.saasService.criarPlano(dto);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Patch('planos/:id')
  atualizarPlano(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarPlanoDto) {
    return this.saasService.atualizarPlano(id, dto);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Get('planos')
  listarPlanos() {
    return this.saasService.listarPlanos();
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Patch('empresas/:id/plano')
  alterarPlanoEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarPlanoDto,
  ) {
    return this.saasService.alterarPlanoEmpresa(id, dto.planoId);
  }
}