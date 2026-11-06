import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FiadosService } from './fiados.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { PagarFiadoDto } from './dto/pagar-fiado.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('fiados')
export class FiadosController {
  constructor(private readonly fiadosService: FiadosService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createFiadoDto: CreateFiadoDto,
  ) {
    return this.fiadosService.create(empresaId, createFiadoDto);
  }

  @Post('pagar/:clienteId')
  registrarPagamento(
    @CurrentTenant() empresaId: number,
    @Param('clienteId') clienteId: string,
    @Body() dto: PagarFiadoDto,
  ) {
    return this.fiadosService.registrarPagamento(empresaId, clienteId, dto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.fiadosService.findAll(empresaId);
  }

  @Get('cliente/:clienteId')
  findByCliente(
    @CurrentTenant() empresaId: number,
    @Param('clienteId') clienteId: string,
  ) {
    return this.fiadosService.findByCliente(empresaId, clienteId);
  }
}