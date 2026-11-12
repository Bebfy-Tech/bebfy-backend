import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AnexoFinanceiroDto {
  @IsIn(['BOLETO', 'COMPROVANTE'])
  tipo: 'BOLETO' | 'COMPROVANTE';

  @IsOptional()
  @IsUUID()
  cobrancaId?: string;
}
