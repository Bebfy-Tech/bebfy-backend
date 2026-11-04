import { Module } from '@nestjs/common';
import { VasilhamesService } from './vasilhames.service';
import { VasilhamesController } from './vasilhames.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VasilhamesController],
  providers: [VasilhamesService],
  exports: [VasilhamesService],
})
export class VasilhamesModule {}