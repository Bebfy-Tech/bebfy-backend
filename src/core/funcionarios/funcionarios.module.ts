import { Module } from '@nestjs/common';
import { FuncionariosService } from './funcionarios.service';
import { FuncionariosController } from './funcionarios.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FuncionariosController],
  providers: [FuncionariosService],
})
export class FuncionariosModule {}
