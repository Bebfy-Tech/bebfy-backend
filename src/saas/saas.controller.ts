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
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { SaasSuperAdminGuard } from './guards/saas-super-admin.guard';
import { AlterarStatusEmpresaDto } from './dto/alterar-status-empresa.dto';
import { AlternarModuloDto } from './dto/alternar-modulo.dto';
import { AlterarPlanoDto } from './dto/alterar-plano.dto';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';

@UseGuards(JwtAuthGuard, SaasSuperAdminGuard)
@Controller('saas/admin')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  // NOVO: Rota POST para incluir uma nova empresa cliente no SaaS
  @Post('empresas')
  criarEmpresa(@Body() dto: CriarEmpresaDto) {
    return this.saasService.criarEmpresa(dto);
  }

  @Get('empresas')
  listarEmpresas() {
    return this.saasService.listarEmpresas();
  }

  @Get('empresas/:id')
  buscarEmpresaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.buscarEmpresaPorId(id);
  }

  @Patch('empresas/:id/status')
  alterarStatusEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarStatusEmpresaDto,
  ) {
    return this.saasService.alterarStatusEmpresa(id, dto.status);
  }

  @Patch('empresas/:id/modulos')
  alternarModuloEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlternarModuloDto,
  ) {
    return this.saasService.alternarModuloEmpresa(id, dto.modulo, dto.ativo);
  }

  @Get('planos')
  listarPlanos() {
    return this.saasService.listarPlanos();
  }

  @Patch('empresas/:id/plano')
  alterarPlanoEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarPlanoDto,
  ) {
    return this.saasService.alterarPlanoEmpresa(id, dto.planoId);
  }
}