import { Body, Controller, ForbiddenException, Get, Param, ParseEnumPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusConta } from '@prisma/client';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CriarContaDto } from './dto/criar-conta.dto';
import { FinanceiroService } from './financeiro.service';

@ApiTags('Financeiro')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  private exigirGestor(req: any) {
    if (!['GERENTE', 'ADMINISTRADOR', 'PROPRIETARIO'].includes(req.user?.cargo)) {
      throw new ForbiddenException('Operação financeira restrita a gestores.');
    }
  }

  @Get('resumo')
  resumo(@CurrentTenant() empresaId: number, @Req() req: any) {
    this.exigirGestor(req);
    return this.service.resumo(empresaId);
  }

  @Post('contas-pagar')
  criarPagar(@CurrentTenant() empresaId: number, @Req() req: any, @Body() dto: CriarContaDto) {
    this.exigirGestor(req);
    return this.service.criar(empresaId, 'pagar', dto);
  }

  @Get('contas-pagar')
  listarPagar(@CurrentTenant() empresaId: number, @Req() req: any, @Query('status', new ParseEnumPipe(StatusConta, { optional: true })) status?: StatusConta) {
    this.exigirGestor(req);
    return this.service.listar(empresaId, 'pagar', status);
  }

  @Patch('contas-pagar/:id/pagar')
  pagar(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.service.alterarStatus(empresaId, 'pagar', id, 'PAGO');
  }

  @Patch('contas-pagar/:id/cancelar')
  cancelarPagar(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.service.alterarStatus(empresaId, 'pagar', id, 'CANCELADO');
  }

  @Post('contas-receber')
  criarReceber(@CurrentTenant() empresaId: number, @Req() req: any, @Body() dto: CriarContaDto) {
    this.exigirGestor(req);
    return this.service.criar(empresaId, 'receber', dto);
  }

  @Get('contas-receber')
  listarReceber(@CurrentTenant() empresaId: number, @Req() req: any, @Query('status', new ParseEnumPipe(StatusConta, { optional: true })) status?: StatusConta) {
    this.exigirGestor(req);
    return this.service.listar(empresaId, 'receber', status);
  }

  @Patch('contas-receber/:id/receber')
  receber(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.service.alterarStatus(empresaId, 'receber', id, 'PAGO');
  }

  @Patch('contas-receber/:id/cancelar')
  cancelarReceber(@CurrentTenant() empresaId: number, @Req() req: any, @Param('id') id: string) {
    this.exigirGestor(req);
    return this.service.alterarStatus(empresaId, 'receber', id, 'CANCELADO');
  }
}
