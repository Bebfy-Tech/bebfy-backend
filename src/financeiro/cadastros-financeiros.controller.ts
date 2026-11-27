import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CadastroFinanceiroDto, SituacaoCadastroDto } from './dto/cadastro-financeiro.dto';
import { CadastrosFinanceirosService } from './cadastros-financeiros.service';
@UseGuards(JwtAuthGuard,TenantGuard)
@Controller('financeiro/cadastros')
export class CadastrosFinanceirosController{
 constructor(private readonly service:CadastrosFinanceirosService){}
 private gestor(req:any){if(!['GERENTE','ADMINISTRADOR','PROPRIETARIO'].includes(req.user?.cargo))throw new ForbiddenException('Cadastro financeiro restrito a gestores.');return req.user.funcionarioId;}
 @Get() listar(@CurrentTenant() empresaId:number,@Req() req:any){this.gestor(req);return this.service.listar(empresaId);}
 @Get('auditoria') auditoria(@CurrentTenant() empresaId:number,@Req() req:any){this.gestor(req);return this.service.auditoria(empresaId);}
 @Post() criar(@CurrentTenant() empresaId:number,@Req() req:any,@Body() dto:CadastroFinanceiroDto){return this.service.criar(empresaId,dto,this.gestor(req));}
 @Patch(':id') editar(@CurrentTenant() empresaId:number,@Req() req:any,@Param('id') id:string,@Body() dto:CadastroFinanceiroDto){return this.service.editar(empresaId,id,dto,this.gestor(req));}
 @Patch(':id/situacao') situacao(@CurrentTenant() empresaId:number,@Req() req:any,@Param('id') id:string,@Body() dto:SituacaoCadastroDto){return this.service.situacao(empresaId,id,dto.ativo,this.gestor(req));}
 @Delete(':id') excluir(@CurrentTenant() empresaId:number,@Req() req:any,@Param('id') id:string){return this.service.excluir(empresaId,id,this.gestor(req));}
}
