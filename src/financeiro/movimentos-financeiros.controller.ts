import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ConciliarDto, TransferirDto, EstornarMovimentoDto } from './dto/movimento-financeiro.dto';
import { MovimentosFinanceirosService } from './movimentos-financeiros.service';
@UseGuards(JwtAuthGuard,TenantGuard)
@Controller('financeiro')
export class MovimentosFinanceirosController{
 constructor(private readonly service:MovimentosFinanceirosService){}
 private gestor(req:any){if(!['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(req.user?.cargo))throw new ForbiddenException('Acesso restrito a gestores.');return req.user.funcionarioId;}
 @Get('saldos') contas(@CurrentTenant() empresaId:number,@Req() req:any){this.gestor(req);return this.service.contas(empresaId);}
 @Get('recebiveis') recebiveis(@CurrentTenant() empresaId:number,@Req() req:any){this.gestor(req);return this.service.recebiveis(empresaId);}
 @Get('historico') historico(@CurrentTenant() empresaId:number,@Req() req:any){this.gestor(req);return this.service.historico(empresaId);}
 @Post('transferencias') transferir(@CurrentTenant() empresaId:number,@Req() req:any,@Body() dto:TransferirDto){return this.service.transferir(empresaId,dto,this.gestor(req));}
 @Post('conciliacoes') conciliar(@CurrentTenant() empresaId:number,@Req() req:any,@Body() dto:ConciliarDto){return this.service.conciliar(empresaId,dto,this.gestor(req));}
 @Post('movimentos/:id/estorno') estornar(@CurrentTenant() empresaId:number,@Req() req:any,@Param('id') id:string,@Body() dto:EstornarMovimentoDto){return this.service.estornar(empresaId,id,dto,this.gestor(req));}
}
