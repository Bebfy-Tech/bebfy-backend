// Importamos o decorador de Módulo do NestJS
import { Module } from '@nestjs/common';
// Importamos o serviço e o controller de Lotes
import { LotesService } from './lotes.service';
import { LotesController } from './lotes.controller';
// Importamos o PrismaModule para disponibilizar o PrismaService ao LotesService
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Injeta o módulo de banco de dados
  controllers: [LotesController], // Registra as rotas do controller
  providers: [LotesService], // Registra o serviço com a regra de negócio
})
export class LotesModule {}
