import { Controller, Get, UseGuards, Req, ForbiddenException, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CentralRelatoriosService } from './central-relatorios.service';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentEmpresa } from '../core/auth/decorators/current-empresa.decorator';

@ApiTags('Relatórios & Dashboard')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService, private readonly central: CentralRelatoriosService) {}

  @ApiOperation({
    summary: 'Obter métricas do Dashboard',
    description: 'Retorna os totais de vendas do dia, produtos mais vendidos e faturamento filtrado por empresa.',
  })
  @ApiResponse({ status: 200, description: 'Métricas do painel retornadas com sucesso.' })
  @Get('dashboard')
  getDashboard(@CurrentEmpresa() empresaId: number, @Req() req: any) {
    if (!['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(req.user?.cargo)) throw new ForbiddenException('Indicadores gerenciais restritos a gestores.');
    return this.relatoriosService.getDashboard(empresaId);
  }
  @Get('catalogo')
  catalogo(@CurrentEmpresa() empresaId:number,@Req() req:any){return this.central.catalogo(empresaId,req.user);}
  @Get('gerar/:codigo')
  gerar(@CurrentEmpresa() empresaId:number,@Req() req:any,@Param('codigo') codigo:string,@Query('inicio') inicio?:string,@Query('fim') fim?:string,@Query('busca') busca?:string){
    return this.central.gerar(empresaId,req.user,codigo,inicio,fim,busca);
  }
  @Get('dashboard/operacional')
  getOperacional(@CurrentEmpresa() empresaId:number, @Req() req:any) {
    return this.relatoriosService.getOperacional(empresaId,req.user.funcionarioId);
  }
}
