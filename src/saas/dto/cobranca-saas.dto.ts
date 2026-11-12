import { IsBoolean, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CriarCobrancaSaasDto {
  @IsString() @MinLength(2) @MaxLength(120) referencia: string;
  @IsNumber({maxDecimalPlaces:2}) @IsPositive() valor: number;
  @IsDateString() vencimento: string;
  @IsOptional() @IsString() @MaxLength(120) linhaDigitavel?: string;
  @IsOptional() @IsString() @MaxLength(500) observacao?: string;
}

export class MarcarPagamentoSaasDto {
  @IsBoolean() pago: boolean;
}
