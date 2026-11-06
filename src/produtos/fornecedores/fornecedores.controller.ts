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
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createFornecedorDto: CreateFornecedorDto,
  ) {
    return this.fornecedoresService.create(empresaId, createFornecedorDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.fornecedoresService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.fornecedoresService.findOne(empresaId, id);
  }

  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateFornecedorDto: UpdateFornecedorDto,
  ) {
    return this.fornecedoresService.update(empresaId, id, updateFornecedorDto);
  }

  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.fornecedoresService.remove(empresaId, id);
  }
}