import { ComprasController } from './compras/compras.controller';
import { ComprasService } from './compras/compras.service';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades-medida';
import { InventariosController } from './inventarios/inventarios.controller';
import { InventariosService } from './inventarios/inventarios.service';
import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { ProdutosController } from './produtos.controller';
import { PrismaModule } from '../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProdutosController, UnidadesController, ComprasController, InventariosController],
  providers: [ProdutosService, UnidadesService, ComprasService, InventariosService],
  exports: [ProdutosService],
})
export class ProdutosModule {}