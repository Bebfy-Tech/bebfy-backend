import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

// Middleware Tenant Multi-tenant
import { TenantMiddleware } from './core/tenant/tenant.middleware';

// Core
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { FuncionariosModule } from './core/funcionarios/funcionarios.module';

// Varejo / PDV
import { CaixaModule } from './varejo/caixa/caixa.module';
import { VendasModule } from './varejo/vendas/vendas.module';
import { FiadosModule } from './varejo/fiados/fiados.module';
import { ClientesModule } from './varejo/clientes/clientes.module';

// Produtos & Estoque
import { ProdutosModule } from './produtos/produtos.module';
import { CategoriasModule } from './produtos/categorias/categorias.module';
import { LotesModule } from './produtos/lotes/lotes.module';
import { FornecedoresModule } from './produtos/fornecedores/fornecedores.module';
import { MovimentacoesEstoqueModule } from './produtos/movimentacoes-estoque/movimentacoes-estoque.module';

// Relatórios
import { RelatoriosModule } from './relatorios/relatorios.module';

@Module({
  imports: [
    // Core
    PrismaModule,
    AuthModule,
    FuncionariosModule,

    // Varejo
    CaixaModule,
    VendasModule,
    FiadosModule,
    ClientesModule,

    // Produtos
    ProdutosModule,
    CategoriasModule,
    LotesModule,
    FornecedoresModule,
    MovimentacoesEstoqueModule,

    // Relatórios
    RelatoriosModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}