import { Module } from '@nestjs/common';
import { SaasService } from './saas.service';
import { SaasController } from './saas.controller';
import { SuporteController } from './suporte.controller';
import { SuporteService } from './suporte.service';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SaasController, SuporteController],
  providers: [SaasService, SuporteService],
  exports: [SaasService],
})
export class SaasModule {}