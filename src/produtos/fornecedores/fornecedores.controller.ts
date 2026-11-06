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
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Estoque & Catálogo')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @ApiOperation({
    summary: 'Cadastrar novo fornecedor',
    description: 'Regista um fornecedor (ex: Ambev, Heineken, Coca-Cola).',
  })
  @ApiResponse({ status: 201, description: 'Fornecedor cadastrado com sucesso.' })
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createFornecedorDto: CreateFornecedorDto,
  ) {
    return this.fornecedoresService.create(empresaId, createFornecedorDto);
  }

  @ApiOperation({
    summary: 'Listar todos os fornecedores',
    description: 'Retorna a lista de fornecedores da empresa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de fornecedores retornada.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.fornecedoresService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar fornecedor por ID',
    description: 'Retorna os detalhes de um fornecedor.',
  })
  @ApiParam({ name: 'id', description: 'ID do fornecedor' })
  @ApiResponse({ status: 200, description: 'Fornecedor encontrado.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.fornecedoresService.findOne(empresaId, id);
  }

  @ApiOperation({
    summary: 'Atualizar fornecedor',
    description: 'Altera os dados de contacto ou cadastro do fornecedor.',
  })
  @ApiParam({ name: 'id', description: 'ID do fornecedor' })
  @ApiResponse({ status: 200, description: 'Fornecedor atualizado com sucesso.' })
  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateFornecedorDto: UpdateFornecedorDto,
  ) {
    return this.fornecedoresService.update(empresaId, id, updateFornecedorDto);
  }

  @ApiOperation({
    summary: 'Remover fornecedor',
    description: 'Exclui o registo de um fornecedor.',
  })
  @ApiParam({ name: 'id', description: 'ID do fornecedor' })
  @ApiResponse({ status: 200, description: 'Fornecedor removido com sucesso.' })
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.fornecedoresService.remove(empresaId, id);
  }
}