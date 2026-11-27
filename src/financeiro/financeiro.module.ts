import { MovimentosFinanceirosService } from './movimentos-financeiros.service';
import { MovimentosFinanceirosController } from './movimentos-financeiros.controller';
import { CadastrosFinanceirosService } from './cadastros-financeiros.service';
import { CadastrosFinanceirosController } from './cadastros-financeiros.controller';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceiroController, CadastrosFinanceirosController, MovimentosFinanceirosController],
  providers: [FinanceiroService, CadastrosFinanceirosService, MovimentosFinanceirosService],
})
export class FinanceiroModule {}
