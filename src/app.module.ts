import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Middleware Multi-tenant
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
import { VasilhamesModule } from './produtos/vasilhames/vasilhames.module';

// Relatórios
import { RelatoriosModule } from './relatorios/relatorios.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { SaasModule } from './saas/saas.module';
import { ImportacaoXmlModule } from './produtos/importacao-xml/importacao-xml.module';

@Module({
  imports: [
    // Rate Limiting com duas políticas: padrão do sistema e proteção de login
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,  // 1 minuto
        limit: 100,  // 100 requisições normais por minuto
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 100,  // Fallback global; endpoints sensíveis definem 5/10 com @Throttle.
      },
    ]),

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
    VasilhamesModule,

    // Relatórios
    RelatoriosModule,
    FinanceiroModule,
    SaasModule,
    ImportacaoXmlModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}