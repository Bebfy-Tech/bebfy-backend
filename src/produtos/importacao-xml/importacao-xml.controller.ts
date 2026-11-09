import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ExigirPermissao, PermissoesGuard } from '../../common/guards/permissoes.guard';
import { ExigirModulo, ModuloAtivoGuard } from '../../common/guards/modulo-ativo.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ImportacaoXmlService } from './importacao-xml.service';
import { XmlConfirmDto, XmlPreviewDto } from './importacao-xml.dto';

@ApiTags('Importação de NF-e XML')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard,TenantGuard,PermissoesGuard,ModuloAtivoGuard)
@ExigirModulo('COMPRAS_FORNECEDORES')
@ExigirPermissao('ESTOQUE_AJUSTAR')
@Controller('estoque/importar-xml')
export class ImportacaoXmlController {
  constructor(private readonly service: ImportacaoXmlService){}
  @Post('previsualizar')
  previsualizar(@CurrentTenant() empresaId:number,@Body() dto:XmlPreviewDto){
    return this.service.preview(empresaId,dto.xml);
  }
  @Post('confirmar')
  confirmar(@CurrentTenant() empresaId:number,@Body() dto:XmlConfirmDto){
    return this.service.confirmar(empresaId,dto);
  }
}
