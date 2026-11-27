import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { InventariosService } from './inventarios.service';

const inteiro = z.number().int().min(0).max(2147483647);
const contagens = z.object({ revisao: inteiro, itens: z.array(z.object({ produtoId: inteiro.min(1), contagem: inteiro }).strict()).min(1).max(200) }).strict();
const contagensLotes = z.object({ revisao: inteiro, itens: z.array(z.object({ produtoId: inteiro.min(1), loteId: inteiro.min(1), contagem: inteiro }).strict()).min(1).max(200) }).strict();
const encerramento = z.object({ revisao: inteiro, motivo: z.string().trim().min(3).max(500) }).strict();
function validar<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException('Dados de inventário inválidos.');
  return r.data;
}

@ApiTags('Estoque & Inventários')
@ApiBearerAuth('JWT-auth')
@Controller('inventarios-estoque')
@UseGuards(JwtAuthGuard, TenantGuard, PermissoesGuard)
@ExigirPermissao('ESTOQUE_AJUSTAR')
export class InventariosController {
  constructor(private readonly service: InventariosService) {}
  private ator(req: { user?: { funcionarioId?: string; cargo?: string } }, gestor = false) {
    if (!req.user?.funcionarioId || (gestor && !['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(req.user.cargo ?? '')))
      throw new ForbiddenException('Operação restrita a funcionário autorizado; encerramento exige gestor.');
    return req.user.funcionarioId;
  }
  @Get() listar(@CurrentTenant() empresaId: number) { return this.service.listar(empresaId); }
  @Get(':id') ficha(@CurrentTenant() empresaId: number, @Param('id', ParseUUIDPipe) id: string) { return this.service.ficha(empresaId, id); }
  @Post() criar(@CurrentTenant() empresaId: number, @Req() req: any) { return this.service.criar(empresaId, this.ator(req)); }
  @Post(':id/contagens') salvar(@CurrentTenant() empresaId: number, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: any) {
    const dto = validar(contagens, body);
    return this.service.salvar(empresaId, id, dto.revisao, dto.itens, this.ator(req));
  }
  @Post(':id/lotes/contagens') salvarLotes(@CurrentTenant() empresaId: number, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: any) {
    const dto = validar(contagensLotes, body);
    return this.service.salvarLotes(empresaId, id, dto.revisao, dto.itens, this.ator(req));
  }
  @Post(':id/fechar') fechar(@CurrentTenant() empresaId: number, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: any) {
    const dto = validar(encerramento, body);
    return this.service.encerrar(empresaId, id, dto.revisao, dto.motivo, this.ator(req, true));
  }
  @Post(':id/cancelar') cancelar(@CurrentTenant() empresaId: number, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() req: any) {
    const dto = validar(encerramento, body);
    return this.service.encerrar(empresaId, id, dto.revisao, dto.motivo, this.ator(req, true), true);
  }
}
