import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FuncionariosService } from './funcionarios.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { ConfigurarAcessoDto } from './dto/configurar-acesso.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

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
    return this.funcionariosService.create(dto, empresaId);
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
    return this.funcionariosService.configurarAcesso(id, empresaId, dto);
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
    return this.funcionariosService.update(id, dto, empresaId);
  }

  @Delete(':id')
  async remove(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    await this.validarAlvo(req, empresaId, id);
    return this.funcionariosService.remove(id, empresaId);
  }
}
