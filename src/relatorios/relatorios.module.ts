import { CentralRelatoriosService } from './central-relatorios.service';
import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, CentralRelatoriosService],
  exports: [RelatoriosService],
})
export class RelatoriosModule {}