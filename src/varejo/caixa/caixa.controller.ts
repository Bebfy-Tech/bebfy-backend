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
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('caixa')
export class CaixaController {
  constructor(private readonly caixaService: CaixaService) {}

  @Post('abrir')
  abrirCaixa(
    @CurrentTenant() empresaId: number,
    @Body() abrirCaixaDto: AbrirCaixaDto,
  ) {
    return this.caixaService.abrirCaixa(empresaId, abrirCaixaDto);
  }

  @Post(':id/movimentacao')
  adicionarMovimentacao(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() movimentacaoDto: MovimentacaoCaixaDto,
  ) {
    return this.caixaService.adicionarMovimentacao(empresaId, id, movimentacaoDto);
  }

  @Patch(':id/fechar')
  fecharCaixa(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() fecharCaixaDto: FecharCaixaDto,
  ) {
    return this.caixaService.fecharCaixa(empresaId, id, fecharCaixaDto);
  }

  @Get('aberto/operador/:operadorId')
  findCaixaAbertoPorOperador(
    @CurrentTenant() empresaId: number,
    @Param('operadorId') operadorId: string,
  ) {
    return this.caixaService.findCaixaAbertoPorOperador(empresaId, operadorId);
  }

  @Get(':id/extrato')
  obterExtratoMovimentacoes(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.caixaService.obterExtratoMovimentacoes(empresaId, id);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.caixaService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.caixaService.findOne(empresaId, id);
  }
}