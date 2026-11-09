import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { CaixaService } from './caixa.service';
import { AbrirCaixaDto } from './dto/abrir-caixa.dto';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';
import { MovimentacaoCaixaDto } from './dto/movimentacao-caixa.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Caixa & Operações')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixaService: CaixaService) {}

  @ApiOperation({
    summary: 'Abrir novo caixa',
    description: 'Abre um caixa para um operador na empresa ativa.',
  })
  @ApiResponse({ status: 201, description: 'Caixa aberto com sucesso.' })
  @ApiResponse({ status: 400, description: 'Já existe um caixa aberto para este operador.' })
  @Post('abrir')
  abrirCaixa(
    @CurrentTenant() empresaId: number,
    @Body() abrirCaixaDto: AbrirCaixaDto,
  ) {
    return this.caixaService.abrirCaixa(empresaId, abrirCaixaDto);
  }

  @ApiOperation({
    summary: 'Adicionar movimentação (Sangria/Suprimento)',
    description: 'Registra uma entrada ou saída manual de dinheiro no caixa aberto.',
  })
  @ApiParam({ name: 'id', description: 'ID do caixa (UUID)' })
  @ApiResponse({ status: 201, description: 'Movimentação registrada com sucesso.' })
  @ApiResponse({ status: 404, description: 'Caixa não encontrado ou fechado.' })
  @ExigirPermissao('CAIXA_MOVIMENTAR')
  @Post(':id/movimentacao')
  adicionarMovimentacao(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() movimentacaoDto: MovimentacaoCaixaDto,
  ) {
    return this.caixaService.adicionarMovimentacao(empresaId, id, movimentacaoDto);
  }

  @ApiOperation({
    summary: 'Fechar caixa',
    description: 'Encerra o turno do caixa, calculando o saldo final e fechamento.',
  })
  @ApiParam({ name: 'id', description: 'ID do caixa (UUID)' })
  @ApiResponse({ status: 200, description: 'Caixa fechado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Caixa já se encontra fechado.' })
  @ExigirPermissao('CAIXA_FECHAR')
  @Patch(':id/fechar')
  fecharCaixa(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() fecharCaixaDto: FecharCaixaDto,
  ) {
    return this.caixaService.fecharCaixa(empresaId, id, fecharCaixaDto);
  }

  @ApiOperation({
    summary: 'Buscar caixa aberto por operador',
    description: 'Retorna os dados do caixa atualmente aberto para determinado operador.',
  })
  @ApiParam({ name: 'operadorId', description: 'ID do operador (UUID)' })
  @ApiResponse({ status: 200, description: 'Caixa aberto retornado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Nenhum caixa aberto encontrado.' })
  @Get('aberto/operador/:operadorId')
  findCaixaAbertoPorOperador(
    @CurrentTenant() empresaId: number,
    @Param('operadorId') operadorId: string,
  ) {
    return this.caixaService.findCaixaAbertoPorOperador(empresaId, operadorId);
  }

  @ApiOperation({
    summary: 'Obter extrato de movimentações do caixa',
    description: 'Lista todas as sangrias, suprimentos e vendas associadas ao caixa.',
  })
  @ApiParam({ name: 'id', description: 'ID do caixa (UUID)' })
  @ApiResponse({ status: 200, description: 'Extrato retornado com sucesso.' })
  @Get(':id/extrato')
  obterExtratoMovimentacoes(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.caixaService.obterExtratoMovimentacoes(empresaId, id);
  }

  @ApiOperation({
    summary: 'Listar todos os caixas da empresa',
    description: 'Retorna o histórico completo de caixas cadastrados.',
  })
  @ApiResponse({ status: 200, description: 'Lista de caixas retornada com sucesso.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.caixaService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar caixa por ID',
    description: 'Retorna os detalhes de um caixa específico.',
  })
  @ApiParam({ name: 'id', description: 'ID do caixa (UUID)' })
  @ApiResponse({ status: 200, description: 'Caixa encontrado.' })
  @ApiResponse({ status: 404, description: 'Caixa não encontrado nesta empresa.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.caixaService.findOne(empresaId, id);
  }
}