import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { ProdutosController } from './produtos.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  // Importa o PrismaModule para disponibilizar a conexão com a base de dados no ProdutosService
  imports: [PrismaModule],
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}