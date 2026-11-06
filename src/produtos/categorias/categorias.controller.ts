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
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createCategoriaDto: CreateCategoriaDto,
  ) {
    return this.categoriasService.create(empresaId, createCategoriaDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.categoriasService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.categoriasService.findOne(empresaId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateCategoriaDto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(empresaId, id, updateCategoriaDto);
  }

  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.categoriasService.remove(empresaId, id);
  }
}