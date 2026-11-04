import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { VasilhamesService } from './vasilhames.service';
import { CriarMovimentacaoCascoDto } from './dto/criar-movimentacao-casco.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('produtos/vasilhames')
export class VasilhamesController {
  constructor(private readonly vasilhamesService: VasilhamesService) {}

  @Post('movimentacao')
  async registrarMovimentacao(
    @Body() dto: CriarMovimentacaoCascoDto,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.vasilhamesService.registrarMovimentacao(dto, empresaId);
  }

  @Get('cliente/:clienteId/extrato')
  async listarExtratoCliente(
    @Param('clienteId') clienteId: string,
    @CurrentEmpresa() empresaId: number,
  ) {
    return this.vasilhamesService.listarExtratoCliente(clienteId, empresaId);
  }
}