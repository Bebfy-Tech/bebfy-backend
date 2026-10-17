// Importamos os decoradores HTTP do NestJS e a proteção por JWT
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CaixaService } from './caixa.service';
import { AbrirCaixaDto } from './dto/abrir-caixa.dto';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';
import { MovimentacaoCaixaDto } from './dto/movimentacao-caixa.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixaService: CaixaService) {}

  // POST /caixa/abrir -> Abre um novo caixa para o operador
  @Post('abrir')
  abrirCaixa(@Body() abrirCaixaDto: AbrirCaixaDto) {
    return this.caixaService.abrirCaixa(abrirCaixaDto);
  }

  // POST /caixa/:id/movimentacao -> Registra Sangria ou Suprimento
  @Post(':id/movimentacao')
  adicionarMovimentacao(
    @Param('id') id: string,
    @Body() movimentacaoDto: MovimentacaoCaixaDto,
  ) {
    return this.caixaService.adicionarMovimentacao(id, movimentacaoDto);
  }

  // PATCH /caixa/:id/fechar -> Realiza o fechamento cego/físico do caixa
  @Patch(':id/fechar')
  fecharCaixa(
    @Param('id') id: string,
    @Body() fecharCaixaDto: FecharCaixaDto,
  ) {
    return this.caixaService.fecharCaixa(id, fecharCaixaDto);
  }

  // GET /caixa/aberto/operador/:operadorId -> Busca o caixa ativo do operador
  @Get('aberto/operador/:operadorId')
  findCaixaAbertoPorOperador(@Param('operadorId') operadorId: string) {
    return this.caixaService.findCaixaAbertoPorOperador(operadorId);
  }

  // GET /caixa -> Lista o histórico de caixas
  @Get()
  findAll() {
    return this.caixaService.findAll();
  }

  // GET /caixa/:id -> Detalhes de um caixa específico
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.caixaService.findOne(id);
  }
}