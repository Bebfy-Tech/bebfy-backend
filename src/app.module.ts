import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProdutosModule } from './produtos/produtos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { LotesModule } from './lotes/lotes.module';

@Module({
  imports: [PrismaModule, AuthModule, ProdutosModule, CategoriasModule, LotesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}