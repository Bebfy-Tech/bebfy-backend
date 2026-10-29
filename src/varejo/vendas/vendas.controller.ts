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
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post()
  create(
    @Body() createVendaDto: CreateVendaDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.vendasService.create(createVendaDto, empresaId);
  }

  @Get('delivery/pendentes-acerto')
  listarPendentesAcertoDelivery(@CurrentEmpresa() empresaId: number) {
    return this.vendasService.listarPendentesAcertoDelivery(empresaId);
  }

  @Patch('delivery/confirmar-acerto')
  confirmarAcertoDelivery(
    @Body('vendaIds') vendaIds: string[],
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.vendasService.confirmarAcertoDelivery(vendaIds, empresaId);
  }

  @Get()
  findAll(@CurrentEmpresa() empresaId: number) {
    return this.vendasService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentEmpresa() empresaId: number) {
    return this.vendasService.findOne(id, empresaId);
  }

  @Patch(':id/cancelar')
  cancelarVenda(@Param('id') id: string, @CurrentEmpresa() empresaId: number) {
    return this.vendasService.cancelarVenda(id, empresaId);
  }
}