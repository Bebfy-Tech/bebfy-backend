import { IsBase64, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AnexoFinanceiroDto {
  @IsString()
  @IsIn(['BOLETO', 'COMPROVANTE'])
  tipo: 'BOLETO' | 'COMPROVANTE';

  @IsOptional()
  @IsUUID()
  cobrancaId?: string;

  @IsString()
  @MaxLength(160)
  nome: string;

  // 2 MiB binary maximum; base64 is approximately 2.8 MiB.
  @IsBase64()
  @MaxLength(2796204)
  arquivoBase64: string;
}
