import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfiguracoesController } from './configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';
@Module({imports:[PrismaModule],controllers:[ConfiguracoesController],providers:[ConfiguracoesService]})
export class ConfiguracoesModule{}
