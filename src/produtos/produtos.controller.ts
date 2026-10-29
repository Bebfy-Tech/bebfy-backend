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
import { CurrentEmpresa } from '../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Post()
  create(
    @Body() createProdutoDto: CreateProdutoDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.create(createProdutoDto, empresaId);
  }

  @Get()
  findAll(@CurrentEmpresa() empresaId: number) {
    return this.produtosService.findAll(empresaId);
  }

  @Get('codigo-barras/:codigo')
  buscarPorCodigoBarras(
    @Param('codigo') codigo: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.buscarPorCodigoBarras(codigo, empresaId);
  }

  @Get('buscar')
  buscarInteligente(
    @Query('q') termo: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.buscarInteligente(termo, empresaId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.findOne(id, empresaId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProdutoDto: UpdateProdutoDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.update(id, updateProdutoDto, empresaId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.produtosService.remove(id, empresaId);
  }
}