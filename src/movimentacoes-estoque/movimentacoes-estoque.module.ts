import { Module } from '@nestjs/common';
import { MovimentacoesEstoqueService } from './movimentacoes-estoque.service';
import { MovimentacoesEstoqueController } from './movimentacoes-estoque.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MovimentacoesEstoqueController],
  providers: [MovimentacoesEstoqueService],
})
export class MovimentacoesEstoqueModule {}