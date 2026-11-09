import { Module } from '@nestjs/common';
import { VendasService } from './vendas.service';
import { ComprovanteService } from './comprovante.service';
import { VendasController } from './vendas.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VendasController],
  providers: [VendasService, ComprovanteService],
  exports: [VendasService],
})
export class VendasModule {}