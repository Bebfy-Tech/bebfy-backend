import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MovimentacoesEstoqueService } from './movimentacoes-estoque.service';
import { CreateMovimentacaoEstoqueDto } from './dto/create-movimentacao-estoque.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Estoque & Catálogo')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('movimentacoes-estoque')
export class MovimentacoesEstoqueController {
  constructor(
    private readonly movimentacoesService: MovimentacoesEstoqueService,
  ) {}

  @ApiOperation({
    summary: 'Registrar movimentação de estoque',
    description: 'Registra manualmente uma entrada, saída, perda ou ajuste de inventário.',
  })
  @ApiResponse({ status: 201, description: 'Movimentação registrada com sucesso.' })
  @ExigirPermissao('ESTOQUE_AJUSTAR')
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createDto: CreateMovimentacaoEstoqueDto,
  ) {
    return this.movimentacoesService.create(empresaId, createDto);
  }

  @ApiOperation({
    summary: 'Listar histórico de movimentações',
    description: 'Retorna a auditoria completa de entradas e saídas de estoque.',
  })
  @ApiResponse({ status: 200, description: 'Histórico retornado com sucesso.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.movimentacoesService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar movimentação por ID',
    description: 'Retorna os detalhes de uma movimentação específica.',
  })
  @ApiParam({ name: 'id', description: 'ID da movimentação' })
  @ApiResponse({ status: 200, description: 'Movimentação encontrada.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.movimentacoesService.findOne(empresaId, id);
  }
}