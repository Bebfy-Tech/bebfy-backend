// Importamos os decoradores do NestJS e o ParseIntPipe para conversão de ID
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
  Req,
} from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  // src/produtos/produtos.controller.ts
  @Post()
  create(@Body() createProdutoDto: CreateProdutoDto, @Req() req: any) {
  // Extrai empresaId do token JWT do usuário ou usa 1 como padrão
  const empresaId = req.user?.empresaId ?? 1;
  return this.produtosService.create(createProdutoDto, empresaId);
  }

  @Get()
  findAll() {
    return this.produtosService.findAll();
  }

  // O ParseIntPipe converte automaticamente a string da URL em número (ex: "1" -> 1)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.produtosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProdutoDto: UpdateProdutoDto,
  ) {
    return this.produtosService.update(id, updateProdutoDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.produtosService.remove(id);
  }
}
