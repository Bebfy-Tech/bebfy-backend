import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { VendasService } from './vendas.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createVendaDto: CreateVendaDto,
  ) {
    return this.vendasService.create(empresaId, createVendaDto);
  }

  @Get('delivery/pendentes-acerto')
  listarPendentesAcertoDelivery(@CurrentTenant() empresaId: number) {
    return this.vendasService.listarPendentesAcertoDelivery(empresaId);
  }

  @Patch('delivery/confirmar-acerto')
  confirmarAcertoDelivery(
    @CurrentTenant() empresaId: number,
    @Body('vendaIds') vendaIds: string[],
  ) {
    return this.vendasService.confirmarAcertoDelivery(empresaId, vendaIds);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.vendasService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.vendasService.findOne(empresaId, id);
  }

  @Patch(':id/cancelar')
  cancelarVenda(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.vendasService.cancelarVenda(empresaId, id);
  }
}