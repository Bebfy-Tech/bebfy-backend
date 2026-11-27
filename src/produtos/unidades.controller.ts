import { Body, Controller, Delete, Get, Param, ParseBoolPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ExigirPermissao, PermissoesGuard } from '../common/guards/permissoes.guard';
import { UnidadeDto, UnidadesService } from './unidades-medida';
@Controller('unidades-medida')
@UseGuards(JwtAuthGuard,TenantGuard,PermissoesGuard)
@ExigirPermissao('PRODUTOS_GERENCIAR')
export class UnidadesController{
 constructor(private readonly service:UnidadesService){}
 @Get() listar(@CurrentTenant() e:number){return this.service.listar(e);}
 @Post() criar(@CurrentTenant() e:number,@Body() d:UnidadeDto){return this.service.criar(e,d);}
 @Patch(':id') editar(@CurrentTenant() e:number,@Param('id') id:string,@Body() d:UnidadeDto){return this.service.editar(e,id,d);}
 @Patch(':id/situacao') situacao(@CurrentTenant() e:number,@Param('id') id:string,@Body('ativo',ParseBoolPipe) ativo:boolean){return this.service.situacao(e,id,ativo);}
 @Delete(':id') excluir(@CurrentTenant() e:number,@Param('id') id:string){return this.service.excluir(e,id);}
}
