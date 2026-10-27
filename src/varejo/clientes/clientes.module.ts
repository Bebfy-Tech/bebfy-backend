import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { PrismaModule } from '../../core/prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Disponibiliza a conexão com a base de dados
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}
