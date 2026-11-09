import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { VendasService } from './vendas.service';
import { ComprovanteService } from './comprovante.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Vendas & PDV')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('vendas')
export class VendasController {
  constructor(private readonly vendasService: VendasService, private readonly comprovantes: ComprovanteService) {}

  @ApiOperation({
    summary: 'Registrar uma nova venda no PDV',
    description:
      'Processa a venda atomicamente. Abate o estoque dos produtos, incrementa cascos do cliente (se retornáveis), atualiza o saldo de fiado (se aplicável) e vincula ao caixa aberto.',
  })
  @ApiResponse({ status: 201, description: 'Venda criada e concluída com sucesso.' })
  @ApiResponse({ status: 400, description: 'Caixa fechado, estoque insuficiente ou limite de crédito do fiado excedido.' })
  @Post()
  async create(
    @CurrentTenant() empresaId: number,
    @Body() createVendaDto: CreateVendaDto,
  ) {
    return this.vendasService.create(empresaId, createVendaDto);
  }

  @ApiOperation({
    summary: 'Listar todas as vendas da empresa',
    description: 'Retorna o histórico de vendas vinculadas ao tenant autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de vendas retornada com sucesso.' })
  @Get()
  async findAll(@CurrentTenant() empresaId: number) {
    return this.vendasService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Listar vendas pendentes de acerto (Delivery)',
    description: 'Retorna vendas marcadas como delivery aguardando acerto de contas pelo entregador.',
  })
  @ApiResponse({ status: 200, description: 'Vendas pendentes de delivery retornadas.' })
  @Get('pendentes-acerto-delivery')
  async listarPendentesAcertoDelivery(@CurrentTenant() empresaId: number) {
    return this.vendasService.listarPendentesAcertoDelivery(empresaId);
  }

  @ApiOperation({
    summary: 'Confirmar acerto de contas de entregas delivery',
    description: 'Atualiza o status de acerto de uma lista de vendas para CONCLUIDO.',
  })
  @ApiResponse({ status: 200, description: 'Acerto de delivery confirmado.' })
  @ExigirPermissao('DELIVERY_ACERTAR')
  @Post('confirmar-acerto-delivery')
  @HttpCode(HttpStatus.OK)
  async confirmarAcertoDelivery(
    @CurrentTenant() empresaId: number,
    @Body('vendaIds') vendaIds: string[],
  ) {
    return this.vendasService.confirmarAcertoDelivery(empresaId, vendaIds);
  }

  @ApiOperation({ summary: 'Comprovante comercial não fiscal para impressão' })
  @Get(':id/comprovante')
  obterComprovante(@CurrentTenant() empresaId: number, @Param('id') id: string) {
    return this.comprovantes.obter(empresaId, id);
  }

  @ApiOperation({
    summary: 'Buscar detalhes de uma venda específica',
    description: 'Retorna os itens, pagamentos, cliente e funcionário vinculados à venda.',
  })
  @ApiParam({ name: 'id', description: 'ID da venda (UUID)' })
  @ApiResponse({ status: 200, description: 'Venda encontrada.' })
  @ApiResponse({ status: 404, description: 'Venda não encontrada nesta empresa.' })
  @Get(':id')
  async findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.vendasService.findOne(empresaId, id);
  }

  @ApiOperation({
    summary: 'Cancelar uma venda realizada',
    description:
      'Estorna atomicamente os produtos para o estoque, desconta os cascos em posse do cliente, cancela o saldo devedor de fiado e altera o status da venda para CANCELADA.',
  })
  @ApiParam({ name: 'id', description: 'ID da venda a cancelar' })
  @ApiResponse({ status: 200, description: 'Venda cancelada e estornos efetuados.' })
  @ApiResponse({ status: 400, description: 'Venda já se encontra cancelada.' })
  @ExigirPermissao('VENDAS_CANCELAR')
  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  async cancelarVenda(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.vendasService.cancelarVenda(empresaId, id);
  }
}