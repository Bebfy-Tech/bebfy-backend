import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FuncionariosService } from './funcionarios.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { ConfigurarAcessoDto } from './dto/configurar-acesso.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { IsArray, IsString, ArrayMaxSize, IsBoolean } from 'class-validator';
import { AtorFuncionario } from './funcionarios-regras';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class PermissoesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  permissoes: string[];
}
class SituacaoAcessoDto {
  @IsBoolean()
  ativo: boolean;
}

@ApiTags('Gestão & Equipa')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly funcionariosService: FuncionariosService) {}

  private exigirGestor(req: any): void {
    if (!['GERENTE', 'ADMINISTRADOR', 'PROPRIETARIO'].includes(req.user?.cargo)) {
      throw new ForbiddenException('Apenas gestores podem administrar funcionários.');
    }
  }

  private ator(req: any): AtorFuncionario {
    if (!req.user?.id || !req.user?.funcionarioId) throw new ForbiddenException('Sessão de gestor inválida.');
    return { id: req.user.id, funcionarioId: req.user.funcionarioId };
  }

  private validarCargoSolicitado(req: any, cargo?: string): void {
    if (!cargo) return;
    if (cargo === 'PROPRIETARIO' && req.user?.cargo !== 'PROPRIETARIO') {
      throw new ForbiddenException('Somente proprietários podem atribuir cargo de proprietário.');
    }
    if (cargo === 'ADMINISTRADOR' && req.user?.cargo === 'GERENTE') {
      throw new ForbiddenException('Gerentes não podem atribuir cargo de administrador.');
    }
  }

  private async validarAlvo(req: any, empresaId: number, id: string): Promise<void> {
    const funcionario = await this.funcionariosService.findOne(id, empresaId);
    this.validarCargoSolicitado(req, funcionario.cargo);
  }

  @Post()
  create(@CurrentTenant() empresaId: number, @Req() req: any, @Body() dto: CreateFuncionarioDto) {
    this.exigirGestor(req);
    this.validarCargoSolicitado(req, dto.cargo);
    return this.funcionariosService.create(dto, empresaId, this.ator(req));
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number, @Req() req: any) {
    this.exigirGestor(req);
    return this.funcionariosService.findAll(empresaId);
  }

  @Post(':id/acesso')
  async configurarAcesso(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string, @Body() dto: ConfigurarAcessoDto) {
    this.exigirGestor(req);
    await this.validarAlvo(req, empresaId, id);
    return this.funcionariosService.configurarAcesso(id, empresaId, dto, this.ator(req));
  }

  @Patch(':id/permissoes')
  permissoes(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string, @Body() dto: PermissoesDto) {
    this.exigirGestor(req);
    return this.funcionariosService.permissoes(id, empresaId, dto.permissoes, this.ator(req));
  }

  @Patch(':id/situacao-acesso')
  situacaoAcesso(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string, @Body() dto: SituacaoAcessoDto) {
    this.exigirGestor(req);
    return this.funcionariosService.situacaoAcesso(id, empresaId, dto.ativo, this.ator(req));
  }

  @Post(':id/revogar-sessao')
  revogarSessao(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.funcionariosService.revogarSessao(id, empresaId, this.ator(req));
  }

  @Get(':id')
  findOne(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.funcionariosService.findOne(id, empresaId);
  }

  @Patch(':id')
  async update(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string, @Body() dto: UpdateFuncionarioDto) {
    this.exigirGestor(req);
    await this.validarAlvo(req, empresaId, id);
    this.validarCargoSolicitado(req, dto.cargo);
    return this.funcionariosService.update(id, dto, empresaId, this.ator(req));
  }

  @Delete(':id')
  async remove(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    await this.validarAlvo(req, empresaId, id);
    return this.funcionariosService.remove(id, empresaId, this.ator(req));
  }
}
