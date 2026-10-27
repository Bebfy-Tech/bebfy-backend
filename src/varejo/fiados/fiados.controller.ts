// Importamos os decoradores do NestJS e o Guard de Autenticação
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FiadosService } from './fiados.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('fiados')
export class FiadosController {
  constructor(private readonly fiadosService: FiadosService) {}

  // POST /fiados -> Lança um débito ou pagamento (crédito) no fiado
  @Post()
  create(@Body() createFiadoDto: CreateFiadoDto) {
    return this.fiadosService.create(createFiadoDto);
  }

  // GET /fiados -> Lista todo o histórico geral de fiados
  @Get()
  findAll() {
    return this.fiadosService.findAll();
  }

  // GET /fiados/cliente/:clienteId -> Busca o extrato de fiados de um cliente específico
  @Get('cliente/:clienteId')
  findByCliente(@Param('clienteId') clienteId: string) {
    return this.fiadosService.findByCliente(clienteId);
  }
}
