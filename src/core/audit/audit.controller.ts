import { Controller, Get, UseGuards, ParseIntPipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentEmpresa } from '../auth/decorators/current-empresa.decorator';

@UseGuards(JwtAuthGuard)
@Controller('auditoria')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  listarLogs(@CurrentEmpresa() empresaId: number) {
    return this.auditService.listarPorEmpresa(empresaId);
  }
}