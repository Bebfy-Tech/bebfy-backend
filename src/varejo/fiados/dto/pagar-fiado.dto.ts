import { IsNumber, IsOptional, IsPositive, IsString, IsIn, IsUUID } from 'class-validator';

export class PagarFiadoDto {
  @IsNumber({maxDecimalPlaces:2}, { message: 'O valor do pagamento deve ser um número.' })
  @IsPositive({ message: 'O valor do pagamento deve ser maior que zero.' })
  valor: number;

  @IsIn(['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO'])
  formaPagamento: string;

  @IsOptional()
  @IsString({ message: 'O ID do caixa deve ser um texto/UUID.' })
  caixaId?: string;

  // Client-generated idempotency key; existing clients may omit it.
  @IsOptional()
  @IsUUID('4')
  chaveRecebimento?: string;
}