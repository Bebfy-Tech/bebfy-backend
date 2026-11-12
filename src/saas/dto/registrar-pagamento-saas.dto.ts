import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class RegistrarPagamentoSaasDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsDateString()
  pagoEm: string;

  @IsString()
  @MaxLength(50)
  forma: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
