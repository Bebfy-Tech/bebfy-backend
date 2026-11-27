import { CadastrosFinanceirosService } from './cadastros-financeiros.service';
import { CadastrosFinanceirosController } from './cadastros-financeiros.controller';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { FinanceiroController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceiroController, CadastrosFinanceirosController],
  providers: [FinanceiroService, CadastrosFinanceirosService],
})
export class FinanceiroModule {}
