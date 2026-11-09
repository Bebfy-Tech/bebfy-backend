import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { ExigirModulo, ModuloAtivoGuard } from '../../common/guards/modulo-ativo.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Estoque & Catálogo')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard, ModuloAtivoGuard)
@ExigirModulo('ESTOQUE_LOTES')
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @ApiOperation({
    summary: 'Cadastrar novo lote de produto',
    description: 'Dá entrada num lote com data de validade e quantidade.',
  })
  @ApiResponse({ status: 201, description: 'Lote criado com sucesso.' })
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createLoteDto: CreateLoteDto,
  ) {
    return this.lotesService.create(empresaId, createLoteDto);
  }

  @ApiOperation({
    summary: 'Listar todos os lotes',
    description: 'Retorna a lista de lotes da empresa ativa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de lotes retornada.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.lotesService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar lote por ID',
    description: 'Retorna os detalhes de um lote específico pelo ID numérico.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico do lote' })
  @ApiResponse({ status: 200, description: 'Lote encontrado.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.lotesService.findOne(empresaId, id);
  }

  @ApiOperation({
    summary: 'Remover lote',
    description: 'Exclui um lote de produtos.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico do lote' })
  @ApiResponse({ status: 200, description: 'Lote removido com sucesso.' })
  @ExigirPermissao('LOTES_REMOVER')
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.lotesService.remove(empresaId, id);
  }
}