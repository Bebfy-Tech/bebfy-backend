// Importamos os decoradores HTTP do NestJS e a proteção por JWT
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

@UseGuards(JwtAuthGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  // POST /vendas -> Processa uma nova venda no PDV
  @Post()
  create(@Body() createVendaDto: CreateVendaDto) {
    return this.vendasService.create(createVendaDto);
  }

  // GET /vendas -> Lista o histórico de vendas
  @Get()
  findAll() {
    return this.vendasService.findAll();
  }

  // GET /vendas/:id -> Detalha uma venda pelo ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendasService.findOne(id);
  }

  // PATCH /vendas/:id/cancelar -> Cancela a venda e devolve o estoque
  @Patch(':id/cancelar')
  cancelarVenda(@Param('id') id: string) {
    return this.vendasService.cancelarVenda(id);
  }
}
