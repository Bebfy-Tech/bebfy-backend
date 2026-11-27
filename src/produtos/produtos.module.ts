import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades-medida';
import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { ProdutosController } from './produtos.controller';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProdutosController, UnidadesController],
  providers: [ProdutosService, UnidadesService],
  exports: [ProdutosService],
})
export class ProdutosModule {}