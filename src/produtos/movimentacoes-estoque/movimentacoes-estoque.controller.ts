import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MovimentacoesEstoqueService } from './movimentacoes-estoque.service';
import { CreateMovimentacaoEstoqueDto } from './dto/create-movimentacao-estoque.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('movimentacoes-estoque')
export class MovimentacoesEstoqueController {
  constructor(
    private readonly movimentacoesService: MovimentacoesEstoqueService,
  ) {}

  // POST /movimentacoes-estoque -> Registra entrada, saída, perda ou ajuste
  @Post()
  create(@Body() createDto: CreateMovimentacaoEstoqueDto) {
    return this.movimentacoesService.create(createDto);
  }

  // GET /movimentacoes-estoque -> Lista o histórico de movimentações
  @Get()
  findAll() {
    return this.movimentacoesService.findAll();
  }

  // GET /movimentacoes-estoque/:id -> Detalhes de uma movimentação
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.movimentacoesService.findOne(id);
  }
}
