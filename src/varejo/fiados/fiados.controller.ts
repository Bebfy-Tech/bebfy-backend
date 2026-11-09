import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FiadosService } from './fiados.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { PagarFiadoDto } from './dto/pagar-fiado.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { ExigirModulo, ModuloAtivoGuard } from '../../common/guards/modulo-ativo.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Clientes & Fiados')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard, ModuloAtivoGuard)
@ExigirModulo('FIADOS')
@Controller('fiados')
export class FiadosController {
  constructor(private readonly fiadosService: FiadosService) {}

  @ApiOperation({
    summary: 'Lançar novo débito/fiado para cliente',
    description: 'Registra uma cobrança no saldo devedor do cliente.',
  })
  @ApiResponse({ status: 201, description: 'Débito lançado com sucesso.' })
  @ExigirPermissao('FIADOS_LANCAR')
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createFiadoDto: CreateFiadoDto,
  ) {
    return this.fiadosService.create(empresaId, createFiadoDto);
  }

  @ApiOperation({
    summary: 'Registrar pagamento/baixa de fiado',
    description: 'Processa o pagamento parcial ou total da dívida de um cliente e atualiza o histórico.',
  })
  @ApiParam({ name: 'clienteId', description: 'ID do cliente' })
  @ApiResponse({ status: 201, description: 'Pagamento abatido com sucesso.' })
  @ExigirPermissao('FIADOS_RECEBER')
  @Post('pagar/:clienteId')
  registrarPagamento(
    @CurrentTenant() empresaId: number,
    @Param('clienteId') clienteId: string,
    @Body() dto: PagarFiadoDto,
  ) {
    return this.fiadosService.registrarPagamento(empresaId, clienteId, dto);
  }

  @ApiOperation({
    summary: 'Listar todos os fiados pendentes',
    description: 'Retorna o histórico geral de contas assinadas na empresa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de fiados retornada.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.fiadosService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Obter histórico de fiado de um cliente',
    description: 'Retorna a ficha completa de débitos e créditos de fiado do cliente.',
  })
  @ApiParam({ name: 'clienteId', description: 'ID do cliente' })
  @ApiResponse({ status: 200, description: 'Histórico do cliente retornado.' })
  @Get('cliente/:clienteId')
  findByCliente(
    @CurrentTenant() empresaId: number,
    @Param('clienteId') clienteId: string,
  ) {
    return this.fiadosService.findByCliente(empresaId, clienteId);
  }
}