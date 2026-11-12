import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ExigirPermissao, PermissoesGuard } from '../common/guards/permissoes.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@ApiTags('Catálogo & Produtos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @ApiOperation({
    summary: 'Cadastrar novo produto',
    description: 'Regista um novo produto no catálogo vinculado à empresa ativa.',
  })
  @ApiResponse({ status: 201, description: 'Produto criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createProdutoDto: CreateProdutoDto,
  ) {
    return this.produtosService.create(createProdutoDto, empresaId);
  }

  @ApiOperation({
    summary: 'Listar todos os produtos',
    description: 'Retorna a lista completa de produtos cadastrados na empresa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de produtos retornada com sucesso.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.produtosService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar produto por código de barras',
    description: 'Localiza um produto específico utilizando o código de barras (EAN/GTIN).',
  })
  @ApiParam({ name: 'codigo', description: 'Código de barras do produto' })
  @ApiResponse({ status: 200, description: 'Produto encontrado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @Get('codigo-barras/:codigo')
  buscarPorCodigoBarras(
    @CurrentTenant() empresaId: number,
    @Param('codigo') codigo: string,
  ) {
    return this.produtosService.buscarPorCodigoBarras(codigo, empresaId);
  }

  @ApiOperation({
    summary: 'Busca inteligente de produtos',
    description: 'Pesquisa produtos por nome, categoria ou código de barras.',
  })
  @ApiQuery({ name: 'q', description: 'Termo de pesquisa', required: true })
  @ApiResponse({ status: 200, description: 'Resultados da pesquisa retornados.' })
  @Get('buscar')
  buscarInteligente(
    @CurrentTenant() empresaId: number,
    @Query('q') termo: string,
  ) {
    return this.produtosService.buscarInteligente(termo, empresaId);
  }

  @ApiOperation({
    summary: 'Buscar produto por ID',
    description: 'Retorna os detalhes de um produto específico pelo seu ID numérico.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico do produto' })
  @ApiResponse({ status: 200, description: 'Produto encontrado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.produtosService.findOne(id, empresaId);
  }

  @ApiOperation({
    summary: 'Atualizar dados de um produto',
    description: 'Altera as informações ou estoque de um produto existente.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico do produto' })
  @ApiResponse({ status: 200, description: 'Produto atualizado com sucesso.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProdutoDto: UpdateProdutoDto,
  ) {
    return this.produtosService.update(id, updateProdutoDto, empresaId);
  }

  @ApiOperation({
    summary: 'Remover/Desativar produto',
    description: 'Remove ou desativa um produto do catálogo.',
  })
  @ApiParam({ name: 'id', description: 'ID numérico do produto' })
  @ApiResponse({ status: 200, description: 'Produto removido com sucesso.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.produtosService.remove(id, empresaId);
  }
}