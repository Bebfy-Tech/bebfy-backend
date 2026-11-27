import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ExigirModulo, ModuloAtivoGuard } from '../../common/guards/modulo-ativo.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ComprasService } from './compras.service';
import { CriarCompraDto, EncerrarCompraDto, ReceberCompraDto } from './compras.dto';

@Controller('compras')
@UseGuards(JwtAuthGuard, TenantGuard, ModuloAtivoGuard)
@ExigirModulo('COMPRAS_FORNECEDORES')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}
  private gestor(req: any): string {
    if (!['PROPRIETARIO', 'ADMINISTRADOR', 'GERENTE'].includes(req.user?.cargo) || !req.user?.funcionarioId)
      throw new ForbiddenException('Compras restritas aos gestores da empresa.');
    return req.user.funcionarioId;
  }
  @Get() listar(@CurrentTenant() empresaId: number, @Req() req: any) {
    this.gestor(req); return this.service.listar(empresaId);
  }
  @Get('referencias') referencias(@CurrentTenant() empresaId: number, @Req() req: any) {
    this.gestor(req); return this.service.referencias(empresaId);
  }
  @Get(':id') ficha(@CurrentTenant() empresaId: number, @Param('id') id: string, @Req() req: any) {
    this.gestor(req); return this.service.ficha(empresaId, id);
  }
  @Post() criar(@CurrentTenant() empresaId: number, @Body() dto: CriarCompraDto, @Req() req: any) {
    return this.service.criar(empresaId, dto, this.gestor(req));
  }
  @Post(':id/confirmar') confirmar(@CurrentTenant() empresaId: number, @Param('id') id: string, @Req() req: any) {
    return this.service.confirmar(empresaId, id, this.gestor(req));
  }
  @Post(':id/encerrar') encerrar(@CurrentTenant() empresaId: number, @Param('id') id: string, @Body() dto: EncerrarCompraDto, @Req() req: any) {
    return this.service.encerrar(empresaId, id, dto.motivo, this.gestor(req));
  }

  @Post(':id/receber') receber(@CurrentTenant() empresaId:number,@Param('id') id:string,@Body() dto:ReceberCompraDto,@Req() req:any){
    return this.service.receber(empresaId,id,dto,this.gestor(req));
  }

  @Post(':id/recebimentos/:recebimentoId/estornar') estornar(@CurrentTenant() empresaId:number,@Param('id') id:string,@Param('recebimentoId') recebimentoId:string,@Body() dto:EncerrarCompraDto,@Req() req:any){
    return this.service.estornarRecebimento(empresaId,id,recebimentoId,dto.motivo,this.gestor(req));
  }
}
