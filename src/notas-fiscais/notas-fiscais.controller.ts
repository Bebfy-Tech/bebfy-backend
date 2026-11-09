import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { ImportarNfeDto } from './dto/importar-nfe.dto';
import { NotasFiscaisService } from './notas-fiscais.service';

@ApiTags('Notas Fiscais')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notas-fiscais')
export class NotasFiscaisController {
  constructor(private readonly service: NotasFiscaisService) {}

  @Post('importar-xml')
  importar(@CurrentTenant() empresaId: number, @Req() req: any, @Body() dto: ImportarNfeDto) {
    if (!['ADMINISTRADOR', 'PROPRIETARIO', 'GERENTE', 'ESTOQUISTA'].includes(req.user?.cargo)) {
      throw new ForbiddenException('Sem autorização para entrada de NF-e.');
    }
    return this.service.importar(empresaId, dto);
  }

  @Get()
  listar(@CurrentTenant() empresaId: number) {
    return this.service.listar(empresaId);
  }
}
