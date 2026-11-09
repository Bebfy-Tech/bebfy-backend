import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { VasilhamesService } from './vasilhames.service';
import { CriarMovimentacaoCascoDto } from './dto/criar-movimentacao-casco.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@Controller('produtos/vasilhames')
export class VasilhamesController {
  constructor(private readonly vasilhamesService: VasilhamesService) {}

  @ExigirPermissao('VASILHAMES_MOVIMENTAR')
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