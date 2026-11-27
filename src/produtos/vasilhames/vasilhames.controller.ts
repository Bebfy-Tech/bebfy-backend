import { Controller, Post, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { VasilhamesService } from './vasilhames.service';
import { CriarMovimentacaoCascoDto } from './dto/criar-movimentacao-casco.dto';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { ExigirModulo, ModuloAtivoGuard } from '../../common/guards/modulo-ativo.guard';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentEmpresa } from '../../core/auth/decorators/current-empresa.decorator';

import { IsInt, IsString, MaxLength, Min } from 'class-validator';
class CriarTipoDto { @IsString() @MaxLength(120) nome:string; }
class AssociarTipoDto { @IsInt() @Min(1) tipoVasilhameId:number; }

@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard, ModuloAtivoGuard)
@ExigirModulo('VASILHAMES_RETORNAVEIS')
@Controller('produtos/vasilhames')
export class VasilhamesController {
  constructor(private readonly vasilhamesService: VasilhamesService) {}

  @Get('tipos')
  tipos(@CurrentEmpresa() empresaId:number){return this.vasilhamesService.tipos(empresaId);}
  @Post('tipos')
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  criarTipo(@CurrentEmpresa() empresaId:number,@Body() dto:CriarTipoDto){return this.vasilhamesService.criarTipo(empresaId,dto.nome);}
  @Patch('produto/:id/tipo')
  @ExigirPermissao('PRODUTOS_GERENCIAR')
  associar(@CurrentEmpresa() empresaId:number,@Param('id',ParseIntPipe) id:number,@Body() dto:AssociarTipoDto){return this.vasilhamesService.associar(empresaId,id,dto.tipoVasilhameId);}
  @Get('historico')
  historico(@CurrentEmpresa() empresaId:number){return this.vasilhamesService.historico(empresaId);}

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