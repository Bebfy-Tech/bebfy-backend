import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FiadosService } from './fiados.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { PagarFiadoDto } from './dto/pagar-fiado.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('fiados')
export class FiadosController {
  constructor(private readonly fiadosService: FiadosService) {}

  @Post()
  create(@Body() createFiadoDto: CreateFiadoDto) {
    return this.fiadosService.create(createFiadoDto);
  }

  @Post('pagar/:clienteId')
  registrarPagamento(
    @Param('clienteId') clienteId: string,
    @Body() dto: PagarFiadoDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.fiadosService.registrarPagamento(clienteId, dto, empresaId);
  }

  @Get()
  findAll(@CurrentEmpresa() empresaId: number) {
    return this.fiadosService.findAll(empresaId);
  }

  @Get('cliente/:clienteId')
  findByCliente(
    @Param('clienteId') clienteId: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.fiadosService.findByCliente(clienteId, empresaId);
  }
}