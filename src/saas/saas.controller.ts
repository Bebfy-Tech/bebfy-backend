import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DefinirInadimplenciaDto, LiberarAcessoTemporarioDto } from './dto/liberacao-financeira.dto';
import { SaasService } from './saas.service';
import { SaasAuthGuard, SaasPermissionGuard } from './saas-auth.guard';
import { AlterarStatusEmpresaDto } from './dto/alterar-status-empresa.dto';
import { AlternarModuloDto } from './dto/alternar-modulo.dto';
import { CriarCobrancaSaasDto, MarcarPagamentoSaasDto } from './dto/cobranca-saas.dto';
import { RegistrarPagamentoSaasDto } from './dto/registrar-pagamento-saas.dto';
import { PersonalizarModuloDto } from './dto/personalizar-modulo.dto';
import { AlterarPlanoDto } from './dto/alterar-plano.dto';
import { CriarEmpresaDto } from './dto/criar-empresa.dto';
import { AtualizarEmpresaSaasDto } from './dto/atualizar-empresa-saas.dto';
import { CriarPlanoDto, AtualizarPlanoDto } from './dto/criar-plano.dto';

@UseGuards(SaasAuthGuard)
@Controller('saas/admin')
export class SaasController {
  constructor(private readonly saasService: SaasService) {}

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('financeiro')
  listarFinanceiro() {
    return this.saasService.listarFinanceiro();
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('financeiro/empresas/:id/historico')
  historicoFinanceiro(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.historicoFinanceiro(id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('financeiro/empresas/:id/cobrancas/:cobrancaId/pagamentos')
  registrarPagamento(
    @Param('id', ParseIntPipe) id: number,
    @Param('cobrancaId') cobrancaId: string,
    @Req() req: any,
    @Body() dto: RegistrarPagamentoSaasDto,
  ) {
    return this.saasService.registrarPagamento(id, cobrancaId, req.saasUser.id, dto);
  }

  // NOVO: Rota POST para incluir uma nova empresa cliente no SaaS
  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('empresas')
  criarEmpresa(@Body() dto: CriarEmpresaDto) {
    return this.saasService.criarEmpresa(dto);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('empresas')
  listarEmpresas() {
    return this.saasService.listarEmpresas();
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('empresas/:id')
  buscarEmpresaPorId(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.buscarEmpresaPorId(id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id')
  editarEmpresa(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarEmpresaSaasDto) {
    return this.saasService.editarEmpresa(id, dto);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/status')
  alterarStatusEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarStatusEmpresaDto,
  ) {
    return this.saasService.alterarStatusEmpresa(id, dto.status);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('empresas/:id/cobrancas')
  listarCobrancas(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.listarCobrancas(id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('empresas/:id/cobrancas')
  criarCobranca(@Param('id', ParseIntPipe) id: number, @Body() dto: CriarCobrancaSaasDto) {
    return this.saasService.criarCobranca(id, dto);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/cobrancas/:cobrancaId/pagamento')
  marcarPagamento(
    @Param('id', ParseIntPipe) id: number, @Param('cobrancaId') cobrancaId: string,
    @Body() dto: MarcarPagamentoSaasDto,
  ) { return this.saasService.marcarPagamento(id, cobrancaId, dto.pago); }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/inadimplencia')
  definirInadimplencia(@Param('id', ParseIntPipe) id: number, @Body() dto: DefinirInadimplenciaDto) {
    return this.saasService.definirInadimplencia(id, dto.inadimplente);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('empresas/:id/liberar-acesso')
  liberarAcesso(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: LiberarAcessoTemporarioDto) {
    return this.saasService.liberarTemporariamente(id, req.saasUser.id, dto.dias, dto.motivo);
  }

  @UseGuards(SaasPermissionGuard('MODULOS'))
  @Get('modulos')
  listarDescricoesModulos() {
    return this.saasService.listarDescricoesModulos();
  }

  @UseGuards(SaasPermissionGuard('MODULOS'))
  @Patch('modulos/:modulo')
  personalizarModulo(@Param('modulo') modulo: string, @Body() dto: PersonalizarModuloDto) {
    return this.saasService.personalizarModulo(modulo, dto);
  }

  @UseGuards(SaasPermissionGuard('MODULOS'))
  @Patch('empresas/:id/modulos')
  alternarModuloEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlternarModuloDto,
  ) {
    return this.saasService.alternarModuloEmpresa(id, dto.modulo, dto.ativo);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Post('planos')
  criarPlano(@Body() dto: CriarPlanoDto) {
    return this.saasService.criarPlano(dto);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Patch('planos/:id')
  atualizarPlano(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarPlanoDto) {
    return this.saasService.atualizarPlano(id, dto);
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Get('planos')
  listarPlanos() {
    return this.saasService.listarPlanos();
  }

  @UseGuards(SaasPermissionGuard('PLANOS'))
  @Patch('empresas/:id/plano')
  alterarPlanoEmpresa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AlterarPlanoDto,
  ) {
    return this.saasService.alterarPlanoEmpresa(id, dto.planoId);
  }
}