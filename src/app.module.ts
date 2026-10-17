import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProdutosModule } from './produtos/produtos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { LotesModule } from './lotes/lotes.module';
import { ClientesModule } from './clientes/clientes.module';
import { FiadosModule } from './fiados/fiados.module';
import { FuncionariosModule } from './funcionarios/funcionarios.module';
import { CaixaModule } from './caixa/caixa.module';

@Module({
  imports: [PrismaModule, AuthModule, ProdutosModule, CategoriasModule, LotesModule, ClientesModule, FiadosModule, FuncionariosModule, CaixaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}