import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ConfiguracoesService } from './configuracoes.service';
import { configuracaoSchema, exigirEditor } from './configuracoes-regras';
import { impressaoSchema } from './impressao-regras';
@ApiTags('Configurações')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard,TenantGuard)
@Controller('configuracoes')
export class ConfiguracoesController{
 constructor(private readonly service:ConfiguracoesService){}
 @Get('impressao')
 impressao(@CurrentTenant() empresaId:number){return this.service.impressao(empresaId);}
 @Patch('impressao')
 salvarImpressao(@CurrentTenant() empresaId:number,@Req() req:any,@Body() body:unknown){
  exigirEditor(req.user.cargo);const dto=impressaoSchema.safeParse(body);
  if(!dto.success)throw new BadRequestException(dto.error.issues.map(i=>i.message));
  return this.service.salvarImpressao(empresaId,req.user.id,dto.data);
 }
 @Get('operacao')
 operacao(@CurrentTenant() empresaId:number){return this.service.operacao(empresaId);}
 @Get()
 consultar(@CurrentTenant() empresaId:number,@Req() req:any){return this.service.consultar(empresaId,req.user.cargo);}
 @Patch()
 salvar(@CurrentTenant() empresaId:number,@Req() req:any,@Body() body:unknown){
  exigirEditor(req.user.cargo);const dto=configuracaoSchema.safeParse(body);
  if(!dto.success)throw new BadRequestException(dto.error.issues.map(i=>i.message));
  return this.service.salvar(empresaId,req.user.id,dto.data);
 }
}
