import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { NotasFiscaisController } from './notas-fiscais.controller';
import { NotasFiscaisService } from './notas-fiscais.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotasFiscaisController],
  providers: [NotasFiscaisService],
})
export class NotasFiscaisModule {}
