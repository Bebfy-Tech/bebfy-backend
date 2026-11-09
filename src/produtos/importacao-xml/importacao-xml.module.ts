import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { ImportacaoXmlController } from './importacao-xml.controller';
import { ImportacaoXmlService } from './importacao-xml.service';

@Module({
 imports:[PrismaModule],
 controllers:[ImportacaoXmlController],
 providers:[ImportacaoXmlService],
})
export class ImportacaoXmlModule {}
