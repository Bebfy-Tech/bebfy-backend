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
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixaService: CaixaService) {}

  @Post('abrir')
  abrirCaixa(
    @Body() abrirCaixaDto: AbrirCaixaDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.abrirCaixa(abrirCaixaDto, empresaId);
  }

  @Post(':id/movimentacao')
  adicionarMovimentacao(
    @Param('id') id: string,
    @Body() movimentacaoDto: MovimentacaoCaixaDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.adicionarMovimentacao(id, movimentacaoDto, empresaId);
  }

  @Patch(':id/fechar')
  fecharCaixa(
    @Param('id') id: string,
    @Body() fecharCaixaDto: FecharCaixaDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.fecharCaixa(id, fecharCaixaDto, empresaId);
  }

  @Get('aberto/operador/:operadorId')
  findCaixaAbertoPorOperador(
    @Param('operadorId') operadorId: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.findCaixaAbertoPorOperador(operadorId, empresaId);
  }

  @Get(':id/extrato')
  obterExtratoMovimentacoes(
    @Param('id') id: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.obterExtratoMovimentacoes(id, empresaId);
  }

  @Get()
  findAll(@CurrentEmpresa() empresaId: number) {
    return this.caixaService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.caixaService.findOne(id, empresaId);
  }
}