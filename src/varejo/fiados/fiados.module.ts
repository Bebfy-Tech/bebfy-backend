import { Module } from '@nestjs/common';
import { FiadosService } from './fiados.service';
import { FiadosController } from './fiados.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FiadosController],
  providers: [FiadosService],
})
export class FiadosModule {}
