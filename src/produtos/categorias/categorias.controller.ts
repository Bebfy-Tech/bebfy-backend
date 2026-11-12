import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Estoque & Catálogo')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @ApiOperation({
    summary: 'Criar categoria de produtos',
    description: 'Cadastra uma nova categoria no catálogo (ex: Cervejas, Destilados, Refrigerantes).',
  })
  @ApiResponse({ status: 201, description: 'Categoria criada com sucesso.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createCategoriaDto: CreateCategoriaDto,
  ) {
    return this.categoriasService.create(empresaId, createCategoriaDto);
  }

  @ApiOperation({
    summary: 'Listar todas as categorias',
    description: 'Retorna as categorias cadastradas na empresa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorias retornada.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.categoriasService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar categoria por ID',
    description: 'Retorna os detalhes de uma categoria específica.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria' })
  @ApiResponse({ status: 200, description: 'Categoria encontrada.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.categoriasService.findOne(empresaId, id);
  }

  @ApiOperation({
    summary: 'Atualizar categoria',
    description: 'Altera os dados de uma categoria existente.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria' })
  @ApiResponse({ status: 200, description: 'Categoria atualizada com sucesso.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateCategoriaDto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(empresaId, id, updateCategoriaDto);
  }

  @ApiOperation({
    summary: 'Remover categoria',
    description: 'Exclui uma categoria do catálogo.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria' })
  @ApiResponse({ status: 200, description: 'Categoria removida com sucesso.' })
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.categoriasService.remove(empresaId, id);
  }
}