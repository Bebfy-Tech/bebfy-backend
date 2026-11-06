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
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createProdutoDto: CreateProdutoDto,
  ) {
    return this.produtosService.create(createProdutoDto, empresaId);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.produtosService.findAll(empresaId);
  }

  @Get('codigo-barras/:codigo')
  buscarPorCodigoBarras(
    @CurrentTenant() empresaId: number,
    @Param('codigo') codigo: string,
  ) {
    return this.produtosService.buscarPorCodigoBarras(codigo, empresaId);
  }

  @Get('buscar')
  buscarInteligente(
    @CurrentTenant() empresaId: number,
    @Query('q') termo: string,
  ) {
    return this.produtosService.buscarInteligente(termo, empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.produtosService.findOne(id, empresaId);
  }

  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProdutoDto: UpdateProdutoDto,
  ) {
    return this.produtosService.update(id, updateProdutoDto, empresaId);
  }

  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.produtosService.remove(id, empresaId);
  }
}