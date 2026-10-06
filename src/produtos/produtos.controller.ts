import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Protege todas as rotas deste controlador exigindo o Token JWT no cabeçalho
@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  // POST /produtos -> Criar produto
  @Post()
  create(@Body() createProdutoDto: CreateProdutoDto) {
    return this.produtosService.create(createProdutoDto);
  }

  // GET /produtos -> Listar todos os produtos
  @Get()
  findAll() {
    return this.produtosService.findAll();
  }

  // GET /produtos/:id -> Procurar um produto específico
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.produtosService.findOne(id);
  }

  // PATCH /produtos/:id -> Atualizar um produto
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProdutoDto: UpdateProdutoDto) {
    return this.produtosService.update(id, updateProdutoDto);
  }

  // DELETE /produtos/:id -> Eliminar um produto
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.produtosService.remove(id);
  }
}