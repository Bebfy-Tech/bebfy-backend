import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MovimentacoesEstoqueService } from './movimentacoes-estoque.service';
import { CreateMovimentacaoEstoqueDto } from './dto/create-movimentacao-estoque.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('movimentacoes-estoque')
export class MovimentacoesEstoqueController {
  constructor(
    private readonly movimentacoesService: MovimentacoesEstoqueService,
  ) {}

  // POST /movimentacoes-estoque -> Registra entrada, saída, perda ou ajuste
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createDto: CreateMovimentacaoEstoqueDto,
  ) {
    return this.movimentacoesService.create(empresaId, createDto);
  }

  // GET /movimentacoes-estoque -> Lista o histórico de movimentações da empresa
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.movimentacoesService.findAll(empresaId);
  }

  // GET /movimentacoes-estoque/:id -> Detalhes de uma movimentação
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.movimentacoesService.findOne(empresaId, id);
  }
}