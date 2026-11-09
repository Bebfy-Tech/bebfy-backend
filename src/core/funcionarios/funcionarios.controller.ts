import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FuncionariosService } from './funcionarios.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
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

  @Post()
  create(@CurrentTenant() empresaId: number, @Req() req: any, @Body() dto: CreateFuncionarioDto) {
    this.exigirGestor(req);
    return this.funcionariosService.create(dto, empresaId);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.funcionariosService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@CurrentTenant() empresaId: number, @Param('id') id: string) {
    return this.funcionariosService.findOne(id, empresaId);
  }

  @Patch(':id')
  update(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string, @Body() dto: UpdateFuncionarioDto) {
    this.exigirGestor(req);
    return this.funcionariosService.update(id, dto, empresaId);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.funcionariosService.remove(id, empresaId);
  }
}
