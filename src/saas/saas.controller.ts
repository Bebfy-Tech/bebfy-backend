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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DefinirInadimplenciaDto, LiberarAcessoTemporarioDto } from './dto/liberacao-financeira.dto';
import { SaasService } from './saas.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AnexoFinanceiroDto } from './dto/anexo-financeiro.dto';
import { CriarChamadoSaasDto, AtualizarChamadoSaasDto, RegistrarInteracaoSaasDto } from './dto/chamado-saas.dto';
import { ConfigurarRecorrenciaSaasDto, GerarMensalidadesSaasDto } from './dto/recorrencia-saas.dto';
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
  @Get('monitoramento')
  listarMonitoramento() {
    return this.saasService.listarMonitoramento();
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/empresas')
  listarEmpresasSuporte() {
    return this.saasService.listarEmpresasSuporte();
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/operadores')
  listarOperadoresSuporte() {
    return this.saasService.listarOperadoresSuporte();
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/chamados')
  listarChamados() {
    return this.saasService.listarChamados();
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/chamados/:id/anexos')
  listarAnexosChamado(@Param('id') id: string) {
    return this.saasService.listarAnexosChamado(id);
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  @Post('suporte/chamados/:id/anexos')
  anexarChamado(@Param('id') id: string, @Req() req: any, @UploadedFile() arquivo: any) {
    return this.saasService.anexarChamado(id, req.saasUser.id, arquivo);
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/chamados/:id/anexos/:anexoId')
  async baixarAnexoChamado(@Param('id') id: string, @Param('anexoId') anexoId: string, @Res() response: Response) {
    const anexo = await this.saasService.baixarAnexoChamado(id, anexoId);
    const extension = anexo.mime === 'application/pdf' ? '.pdf' : anexo.mime === 'image/png' ? '.png' : '.jpg';
    response.setHeader('Content-Type', anexo.mime);
    response.setHeader('Content-Disposition', 'attachment; filename="suporte-' + anexo.id + extension + '"');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.end(Buffer.from(anexo.conteudo));
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Get('suporte/chamados/:id')
  buscarChamado(@Param('id') id: string) {
    return this.saasService.buscarChamado(id);
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Post('suporte/chamados')
  criarChamado(@Req() req: any, @Body() dto: CriarChamadoSaasDto) {
    return this.saasService.criarChamado(req.saasUser.id, dto);
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Patch('suporte/chamados/:id')
  atualizarChamado(@Param('id') id: string, @Req() req: any, @Body() dto: AtualizarChamadoSaasDto) {
    return this.saasService.atualizarChamado(id, req.saasUser.id, dto);
  }

  @UseGuards(SaasPermissionGuard('SUPORTE'))
  @Post('suporte/chamados/:id/interacoes')
  registrarInteracao(@Param('id') id: string, @Req() req: any, @Body() dto: RegistrarInteracaoSaasDto) {
    return this.saasService.registrarInteracaoChamado(id, req.saasUser.id, dto.mensagem);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('financeiro/empresas/:id/recorrencia')
  configurarRecorrencia(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: ConfigurarRecorrenciaSaasDto) {
    return this.saasService.configurarRecorrencia(id, req.saasUser.id, dto.recorrente, dto.diaVencimento);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Post('financeiro/gerar-mensalidades')
  gerarMensalidades(@Req() req: any, @Body() dto: GerarMensalidadesSaasDto) {
    return this.saasService.gerarMensalidades(dto.competencia, req.saasUser.id);
  }

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

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('financeiro/empresas/:id/anexos')
  listarAnexosFinanceiros(@Param('id', ParseIntPipe) id: number) {
    return this.saasService.listarAnexosFinanceiros(id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  @Post('financeiro/empresas/:id/anexos')
  anexarFinanceiro(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() dto: AnexoFinanceiroDto,
    @UploadedFile() arquivo: any,
  ) {
    return this.saasService.anexarFinanceiro(id, req.saasUser.id, dto, arquivo);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Get('financeiro/empresas/:id/anexos/:anexoId')
  async baixarAnexoFinanceiro(
    @Param('id', ParseIntPipe) id: number,
    @Param('anexoId') anexoId: string,
    @Res() response: Response,
  ) {
    const file = await this.saasService.baixarAnexoFinanceiro(id, anexoId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'attachment; filename="documento-' + file.id + (file.mime === 'application/pdf' ? '.pdf' : file.mime === 'image/png' ? '.png' : '.jpg') + '"');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.end(Buffer.from(file.conteudo));
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
  criarCobranca(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: CriarCobrancaSaasDto) {
    return this.saasService.criarCobranca(id, dto, req.saasUser.id);
  }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/cobrancas/:cobrancaId/pagamento')
  marcarPagamento(
    @Param('id', ParseIntPipe) id: number, @Param('cobrancaId') cobrancaId: string,
    @Req() req: any, @Body() dto: MarcarPagamentoSaasDto,
  ) { return this.saasService.marcarPagamento(id, cobrancaId, dto.pago, req.saasUser.id); }

  @UseGuards(SaasPermissionGuard('EMPRESAS'))
  @Patch('empresas/:id/inadimplencia')
  definirInadimplencia(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: DefinirInadimplenciaDto) {
    return this.saasService.definirInadimplencia(id, dto.inadimplente, req.saasUser.id);
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